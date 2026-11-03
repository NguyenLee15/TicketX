using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;

namespace TickeX.Application.Tickets.Queries;

public record OfflineTicketItem(
    Guid TicketId,
    string TicketCode,
    string SeatNumber,
    string AttendeeName,
    string QrSignatureHash,
    bool IsAlreadyUsed,
    DateTime? CheckedInAt
);

public record EventOfflineManifestDto(
    Guid EventId,
    string EventTitle,
    DateTime GeneratedAtUtc,
    int TotalTickets,
    IReadOnlyList<OfflineTicketItem> Tickets
);

public record GetEventOfflineManifestQuery(Guid EventId) : IRequest<EventOfflineManifestDto>;

public class GetEventOfflineManifestQueryHandler : IRequestHandler<GetEventOfflineManifestQuery, EventOfflineManifestDto>
{
    private readonly IApplicationDbContext _context;

    public GetEventOfflineManifestQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<EventOfflineManifestDto> Handle(GetEventOfflineManifestQuery request, CancellationToken cancellationToken)
    {
        var evt = await _context.Events
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == request.EventId, cancellationToken);

        if (evt == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy sự kiện với ID {request.EventId}.");
        }

        var tickets = await _context.Tickets
            .AsNoTracking()
            .Include(t => t.Seat)
            .Include(t => t.User)
            .Where(t => t.EventId == request.EventId &&
                        (t.Status == TicketStatus.Paid || t.Status == TicketStatus.Used))
            .OrderBy(t => t.Seat.Row)
            .ThenBy(t => t.Seat.Number)
            .ToListAsync(cancellationToken);

        var items = tickets.Select(t => new OfflineTicketItem(
            TicketId: t.Id,
            TicketCode: !string.IsNullOrEmpty(t.QrCodeSignature) && t.QrCodeSignature.Length > 8
                ? t.QrCodeSignature[..8].ToUpperInvariant()
                : t.Id.ToString()[..8].ToUpperInvariant(),
            SeatNumber: $"{t.Seat.Row}{t.Seat.Number}",
            AttendeeName: t.User?.Name ?? "Khán giả",
            QrSignatureHash: t.QrCodeSignature,
            IsAlreadyUsed: t.Status == TicketStatus.Used,
            CheckedInAt: t.CheckedInAt
        )).ToList();

        return new EventOfflineManifestDto(
            EventId: evt.Id,
            EventTitle: evt.Title,
            GeneratedAtUtc: DateTime.UtcNow,
            TotalTickets: items.Count,
            Tickets: items
        );
    }
}
