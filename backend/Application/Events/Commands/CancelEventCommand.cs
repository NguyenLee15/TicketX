using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TickeX.Application.Admin;
using TickeX.Application.Common.Models;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;

namespace TickeX.Application.Events.Commands;

public record CancelEventCommand(
    Guid Id, 
    string Reason, 
    string? ExpectedVersion = null,
    Guid? AdminUserId = null, 
    string AdminEmail = "admin@tickex.com", 
    string? IpAddress = null
) : IRequest<AdminOperationResult>;

public class CancelEventCommandHandler : IRequestHandler<CancelEventCommand, AdminOperationResult>
{
    private readonly IApplicationDbContext _context;
    private readonly IRefundRequestPort _refundRequestPort;
    private readonly IDistributedLockService? _lockService;
    private readonly ISeatNotificationService? _seatNotificationService;
    private readonly ICustomerEventCatalogCache? _catalogCache;
    private readonly ILogger<CancelEventCommandHandler>? _logger;

    public CancelEventCommandHandler(
        IApplicationDbContext context, 
        IRefundRequestPort refundRequestPort, 
        IDistributedLockService? lockService = null,
        ISeatNotificationService? seatNotificationService = null,
        ICustomerEventCatalogCache? catalogCache = null,
        ILogger<CancelEventCommandHandler>? logger = null)
    {
        _context = context;
        _refundRequestPort = refundRequestPort;
        _lockService = lockService;
        _seatNotificationService = seatNotificationService;
        _catalogCache = catalogCache;
        _logger = logger;
    }

    public async Task<AdminOperationResult> Handle(CancelEventCommand request, CancellationToken cancellationToken)
    {
        IDistributedLockLease? eventLease = null;
        if (_lockService is not null)
        {
            try
            {
                eventLease = await _lockService.AcquireLockAsync(
                    $"event:cancel:{request.Id:N}", TimeSpan.FromSeconds(30), cancellationToken);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Distributed lock unavailable when attempting to cancel event {EventId}", request.Id);
                return AdminOperationResult.Conflict("Không thể khóa thao tác hủy sự kiện lúc này. Vui lòng thử lại.", "EVENT_LOCK_UNAVAILABLE");
            }

            if (eventLease is null || !eventLease.IsValid)
            {
                if (eventLease is not null) await eventLease.DisposeAsync();
                return AdminOperationResult.Conflict("Thao tác hủy sự kiện đang được xử lý. Vui lòng thử lại.", "EVENT_LOCK_UNAVAILABLE");
            }
        }

        if (string.IsNullOrWhiteSpace(request.ExpectedVersion))
            return AdminOperationResult.BadRequest("Phiên bản dữ liệu sự kiện (ExpectedVersion) là bắt buộc.", "VERSION_REQUIRED");

        if (!AdminMutationVersionPolicy.TryDecodeRequiredVersion(request.ExpectedVersion, out var expectedBytes))
            return AdminOperationResult.BadRequest("ExpectedVersion không hợp lệ.", "INVALID_VERSION");

        await using (eventLease)
        {
            var strategy = _context.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                var ev = await _context.Events
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

                if (ev == null)
                    return AdminOperationResult.NotFound("Không tìm thấy sự kiện.");

                if (ev.IsDeleted)
                    return AdminOperationResult.BadRequest("Không thể hủy sự kiện đã bị xóa.", "EVENT_ALREADY_DELETED");

                if (!ev.Version.SequenceEqual(expectedBytes))
                    return AdminOperationResult.Conflict(
                        "Sự kiện vừa được cập nhật bởi quản trị viên khác. Vui lòng tải lại dữ liệu mới nhất.",
                        "EVENT_CONCURRENCY_CONFLICT");

                if (ev.Status == EventStatus.Cancelled)
                    return AdminOperationResult.BadRequest("Sự kiện này đã ở trạng thái Đã Hủy trước đó.", "EVENT_ALREADY_CANCELLED");

                if (ev.Status == EventStatus.Completed)
                    return AdminOperationResult.BadRequest("Không thể hủy sự kiện đã kết thúc.", "EVENT_ALREADY_COMPLETED");

                await using var transaction = await _context.BeginTransactionAsync(cancellationToken);
                var beforeStatus = ev.Status.ToString();
                ev.Cancel();
                const int batchSize = 500;
                var refundedCount = 0;
                decimal refundPendingAmount = 0m;
                var releasedSeatCount = 0;
                var releasedSeatIds = new List<Guid>();

                while (true)
                {
                    var tickets = await _context.Tickets
                        .Where(t => t.EventId == request.Id && (t.Status == TicketStatus.Paid || t.Status == TicketStatus.Pending))
                        .OrderBy(t => t.Id)
                        .Take(batchSize)
                        .ToListAsync(cancellationToken);
                    if (tickets.Count == 0) break;

                    var ticketIds = tickets.Select(t => t.Id).ToArray();
                    var paymentRows = await _context.PaymentTransactions
                        .Where(p => ticketIds.Contains(p.TicketId))
                        .ToListAsync(cancellationToken);
                    var paymentsByTicket = paymentRows
                        .GroupBy(p => p.TicketId)
                        .ToDictionary(g => g.Key, g => g.OrderByDescending(p => p.CreatedAt).First());
                    var userIds = tickets.Where(t => t.Status == TicketStatus.Paid).Select(t => t.UserId).Distinct().ToArray();
                    var destinations = await _context.RefundBankAccounts.AsNoTracking()
                        .Where(x => userIds.Contains(x.UserId))
                        .ToDictionaryAsync(x => x.UserId, x => x.EncryptedPayload, cancellationToken);
                    var refundItems = new List<RefundEnqueueItem>();

                    foreach (var ticket in tickets)
                    {
                        if (ticket.Status == TicketStatus.Paid)
                        {
                            ticket.MarkRefundPending();
                            if (paymentsByTicket.TryGetValue(ticket.Id, out var payment))
                                payment.MarkRefundInitiated($"Event cancelled: {request.Reason}");

                            refundItems.Add(new RefundEnqueueItem(
                                request.Id,
                                ticket.Id,
                                ticket.Price,
                                $"event-cancel:{request.Id:N}:ticket:{ticket.Id:N}",
                                destinations.GetValueOrDefault(ticket.UserId)));
                            refundedCount++;
                            refundPendingAmount += ticket.Price;
                        }
                        else
                        {
                            ticket.Cancel();
                        }
                    }

                    if (refundItems.Count > 0)
                    {
                        var enqueueResult = await _refundRequestPort.EnqueueAsync(refundItems, cancellationToken);
                        if (enqueueResult != RefundEnqueueResult.Created)
                            return AdminOperationResult.Conflict("Dữ liệu hoàn tiền vừa thay đổi. Vui lòng thử lại.", "REFUND_CONCURRENCY_CONFLICT");
                    }
                    else
                    {
                        await _context.SaveChangesAsync(cancellationToken);
                    }

                    DetachProcessedEntities();
                }

                while (true)
                {
                    var seats = await _context.Seats
                        .Where(s => s.EventId == request.Id && s.Status == SeatStatus.Locked)
                        .OrderBy(s => s.Id)
                        .Take(batchSize)
                        .ToListAsync(cancellationToken);
                    if (seats.Count == 0) break;

                    foreach (var seat in seats)
                    {
                        seat.Release();
                        releasedSeatIds.Add(seat.Id);
                    }
                    releasedSeatCount += seats.Count;
                    await _context.SaveChangesAsync(cancellationToken);
                    DetachProcessedEntities();
                }

                _context.AuditLogs.Add(new AuditLog(
                    userId: request.AdminUserId,
                    userEmail: request.AdminEmail,
                    action: "CANCEL_EVENT",
                    entityName: "Event",
                    entityId: ev.Id.ToString(),
                    beforeState: $"Status={beforeStatus}",
                    afterState: $"Status=Cancelled,Reason={request.Reason},RefundPendingCount={refundedCount},RefundPendingAmount={refundPendingAmount},SeatsReleased={releasedSeatCount}",
                    ipAddress: request.IpAddress));

                try
                {
                    await _context.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                }
                catch (DbUpdateConcurrencyException)
                {
                    return AdminOperationResult.Conflict(
                        "Sự kiện vừa được cập nhật bởi quản trị viên khác. Vui lòng tải lại dữ liệu mới nhất.",
                        "EVENT_CONCURRENCY_CONFLICT");
                }

                if (_seatNotificationService is not null && releasedSeatIds.Count > 0)
                {
                    await Parallel.ForEachAsync(releasedSeatIds, new ParallelOptions
                    {
                        MaxDegreeOfParallelism = 10,
                        CancellationToken = cancellationToken
                    }, async (seatId, _) =>
                    {
                        try
                        {
                            await _seatNotificationService.NotifySeatStatusChanged(request.Id, seatId, SeatStatus.Available.ToString());
                        }
                        catch (Exception ex)
                        {
                            _logger?.LogWarning(ex, "Failed to send seat status notification for event {EventId} seat {SeatId} after cancel", request.Id, seatId);
                        }
                    });
                }

                if (_catalogCache != null)
                {
                    try { await _catalogCache.InvalidateAsync(cancellationToken); }
                    catch (Exception ex)
                    {
                        _logger?.LogWarning(ex, "Failed to invalidate customer event catalog cache after event {EventId} was cancelled", request.Id);
                    }
                }

                return AdminOperationResult.Ok($"Hủy sự kiện thành công. Đã tạo yêu cầu hoàn tiền cho {refundedCount} vé và giải phóng {releasedSeatCount} ghế chưa bán.");
            });
        }
    }

    private void DetachProcessedEntities()
    {
        if (_context is not DbContext dbContext) return;

        foreach (var entry in dbContext.ChangeTracker.Entries()
                     .Where(entry => entry.Entity is Ticket or PaymentTransaction or RefundRequest or Seat)
                     .ToList())
        {
            entry.State = EntityState.Detached;
        }
    }
}
