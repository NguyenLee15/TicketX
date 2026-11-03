using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;

namespace TickeX.Application.Tickets.Commands;

public record OfflineCheckInRecord(
    Guid TicketId,
    DateTime ScannedAtUtc,
    string Gate,
    string StaffId,
    string DeviceId
);

public record OfflineCheckInConflictDetail(
    Guid TicketId,
    string SeatNumber,
    string ConflictCode,
    string Message,
    DateTime OriginalScanUtc,
    DateTime RejectedScanUtc,
    string Gate
);

public record SyncOfflineCheckInsResult(
    int TotalProcessed,
    int Successful,
    int DuplicatesRejected,
    IReadOnlyList<OfflineCheckInConflictDetail> Conflicts
);

public record SyncOfflineCheckInsCommand(
    Guid EventId,
    IReadOnlyList<OfflineCheckInRecord> CheckIns
) : IRequest<SyncOfflineCheckInsResult>;

public class SyncOfflineCheckInsCommandHandler : IRequestHandler<SyncOfflineCheckInsCommand, SyncOfflineCheckInsResult>
{
    private readonly IApplicationDbContext _context;

    public SyncOfflineCheckInsCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<SyncOfflineCheckInsResult> Handle(SyncOfflineCheckInsCommand request, CancellationToken cancellationToken)
    {
        if (request.CheckIns == null || request.CheckIns.Count == 0)
        {
            return new SyncOfflineCheckInsResult(0, 0, 0, Array.Empty<OfflineCheckInConflictDetail>());
        }

        var ticketIds = request.CheckIns.Select(c => c.TicketId).Distinct().ToList();

        var tickets = await _context.Tickets
            .Include(t => t.Seat)
            .Where(t => ticketIds.Contains(t.Id) && t.EventId == request.EventId)
            .ToListAsync(cancellationToken);

        var ticketMap = tickets.ToDictionary(t => t.Id);

        int successful = 0;
        int duplicatesRejected = 0;
        var conflicts = new List<OfflineCheckInConflictDetail>();

        // Sort incoming check-ins by timestamp to process earlier scans first
        var sortedScans = request.CheckIns.OrderBy(c => c.ScannedAtUtc).ToList();

        foreach (var scan in sortedScans)
        {
            if (!ticketMap.TryGetValue(scan.TicketId, out var ticket))
            {
                conflicts.Add(new OfflineCheckInConflictDetail(
                    TicketId: scan.TicketId,
                    SeatNumber: "N/A",
                    ConflictCode: "TICKET_NOT_FOUND",
                    Message: "Không tìm thấy vé trong sự kiện này.",
                    OriginalScanUtc: DateTime.UtcNow,
                    RejectedScanUtc: scan.ScannedAtUtc,
                    Gate: scan.Gate
                ));
                duplicatesRejected++;
                continue;
            }

            var seatCode = ticket.Seat != null ? $"{ticket.Seat.Row}{ticket.Seat.Number}" : "N/A";

            // If ticket is not yet used on server
            if (ticket.Status == TicketStatus.Paid)
            {
                ticket.CheckIn();
                successful++;
            }
            else if (ticket.Status == TicketStatus.Used)
            {
                var originalScanTime = ticket.CheckedInAt ?? ticket.UpdatedAt ?? DateTime.UtcNow;

                // If this scan happened after the ticket was already used -> FRAUD DUPLICATE SCAN
                conflicts.Add(new OfflineCheckInConflictDetail(
                    TicketId: ticket.Id,
                    SeatNumber: seatCode,
                    ConflictCode: "DUPLICATE_SCAN_REJECTED",
                    Message: $"Vé đã qua cổng lúc {originalScanTime:HH:mm:ss dd/MM/yyyy}. Lượt quét tại cổng {scan.Gate} bị từ chối.",
                    OriginalScanUtc: originalScanTime,
                    RejectedScanUtc: scan.ScannedAtUtc,
                    Gate: scan.Gate
                ));
                duplicatesRejected++;
            }
            else
            {
                conflicts.Add(new OfflineCheckInConflictDetail(
                    TicketId: ticket.Id,
                    SeatNumber: seatCode,
                    ConflictCode: "INVALID_TICKET_STATUS",
                    Message: $"Trạng thái vé không hợp lệ: {ticket.Status}.",
                    OriginalScanUtc: DateTime.UtcNow,
                    RejectedScanUtc: scan.ScannedAtUtc,
                    Gate: scan.Gate
                ));
                duplicatesRejected++;
            }
        }

        if (successful > 0)
        {
            try
            {
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException ex)
            {
                // One or more tickets were concurrently modified by another scanner or process.
                // Reload conflicted entries and isolate them so non-conflicted check-ins still persist.
                foreach (var entry in ex.Entries)
                {
                    if (entry.Entity is Ticket conflictedTicket)
                    {
                        await entry.ReloadAsync(cancellationToken);
                        var scan = sortedScans.FirstOrDefault(s => s.TicketId == conflictedTicket.Id);
                        var gate = scan?.Gate ?? "Unknown";
                        var scannedAt = scan?.ScannedAtUtc ?? DateTime.UtcNow;
                        var origTime = conflictedTicket.CheckedInAt ?? conflictedTicket.UpdatedAt ?? DateTime.UtcNow;

                        conflicts.Add(new OfflineCheckInConflictDetail(
                            TicketId: conflictedTicket.Id,
                            SeatNumber: conflictedTicket.Seat != null ? $"{conflictedTicket.Seat.Row}{conflictedTicket.Seat.Number}" : "N/A",
                            ConflictCode: "CONCURRENT_SCAN_CONFLICT",
                            Message: $"Xung đột quét đồng thời: Vé đã được xử lý bởi trạm khác lúc {origTime:HH:mm:ss dd/MM/yyyy}.",
                            OriginalScanUtc: origTime,
                            RejectedScanUtc: scannedAt,
                            Gate: gate
                        ));
                        duplicatesRejected++;
                    }
                }

                try
                {
                    await _context.SaveChangesAsync(cancellationToken);
                    successful = Math.Max(0, request.CheckIns.Count - duplicatesRejected);
                }
                catch (Exception)
                {
                    successful = Math.Max(0, request.CheckIns.Count - duplicatesRejected);
                }
            }
        }

        return new SyncOfflineCheckInsResult(
            TotalProcessed: request.CheckIns.Count,
            Successful: successful,
            DuplicatesRejected: duplicatesRejected,
            Conflicts: conflicts
        );
    }
}

