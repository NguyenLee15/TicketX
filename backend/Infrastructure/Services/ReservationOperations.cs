using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TickeX.Application.Interfaces;
using TickeX.Application.Seats;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;

namespace TickeX.Infrastructure.Services;

public sealed class ReservationOperations : IReservationOperations
{
    private readonly IApplicationDbContext _context;
    private readonly IDistributedLockService _locks;
    private readonly ISeatNotificationService _notifications;
    private readonly IReservationExpiryScheduler _scheduler;
    private readonly ReservationOptions _options;
    private readonly ILogger<ReservationOperations> _logger;
    private readonly ITimePolicy _time;
    private readonly ICustomerEventCatalogCache? _catalogCache;

    public ReservationOperations(
        IApplicationDbContext context,
        IDistributedLockService locks,
        ISeatNotificationService notifications,
        IReservationExpiryScheduler scheduler,
        IOptions<ReservationOptions> options,
        ILogger<ReservationOperations> logger,
        ITimePolicy? time = null,
        ICustomerEventCatalogCache? catalogCache = null)
    {
        _context = context;
        _locks = locks;
        _notifications = notifications;
        _scheduler = scheduler;
        _options = options.Value;
        _logger = logger;
        _time = time ?? new UtcTimePolicy();
        _catalogCache = catalogCache;
    }

    public async Task<ReservationResult> ReserveAsync(Guid eventId, Guid seatId, Guid userId, byte[] version, CancellationToken cancellationToken)
    {
        var limitKey = $"seat-limit:{userId}:{eventId}";
        var limitLease = await TryAcquireAsync(limitKey, TimeSpan.FromSeconds(30), cancellationToken);
        if (limitLease is null)
            return Fail("RESERVATION_LOCK_UNAVAILABLE", "Không thể khóa thao tác đặt vé lúc này. Vui lòng thử lại.");

        await using (limitLease)
        {
            var holdThreshold = _time.UtcNow.AddMinutes(-_options.HoldMinutes);
            var pendingCount = await _context.Tickets.AsNoTracking().CountAsync(
                t => t.UserId == userId && t.EventId == eventId && t.Status == TicketStatus.Pending && t.CreatedAt > holdThreshold,
                cancellationToken);
            if (pendingCount >= _options.MaximumPendingSeatsPerEvent)
                return Fail("RESERVATION_LIMIT_REACHED", $"Mỗi khách chỉ được giữ tối đa {_options.MaximumPendingSeatsPerEvent} ghế cho một sự kiện.");

            var seatKey = $"seat:lock:{seatId:N}";
            var seatLease = await TryAcquireAsync(seatKey, TimeSpan.FromSeconds(30), cancellationToken);
            if (seatLease is null)
                return Fail("RESERVATION_LOCK_UNAVAILABLE", "Ghế đang được xử lý hoặc dịch vụ khóa tạm thời chưa sẵn sàng.");

            try
            {
            await using (seatLease)
            {
                var seat = await _context.Seats.Include(s => s.Event)
                    .FirstOrDefaultAsync(s => s.Id == seatId && s.EventId == eventId, cancellationToken);
                if (seat?.Event == null || seat.Event.IsDeleted || seat.Event.Status != EventStatus.Published || seat.Event.Date <= _time.UtcNow)
                    return Fail("EVENT_NOT_ON_SALE", "Sự kiện không còn mở bán.");

                if (version.Length == 0 || !seat.Version.SequenceEqual(version))
                    return Fail("SEAT_VERSION_CONFLICT", "Trạng thái ghế đã thay đổi. Vui lòng chọn lại.");

                var holdDuration = TimeSpan.FromMinutes(_options.HoldMinutes);
                var expired = seat.IsLockExpired(holdDuration, _time.UtcNow);
                if (seat.Status != SeatStatus.Available && !expired)
                    return Fail("SEAT_UNAVAILABLE", "Ghế đã được giữ hoặc bán.");

                if (expired)
                {
                    var oldTickets = await _context.Tickets
                        .Where(t => t.SeatId == seat.Id && t.Status == TicketStatus.Pending)
                        .ToListAsync(cancellationToken);
                    foreach (var oldTicket in oldTickets) oldTicket.Cancel();
                    seat.ReclaimLock(userId, _time.UtcNow);
                }
                else
                {
                    seat.Lock(userId, _time.UtcNow);
                }

                var ticket = new Ticket(eventId, seatId, userId, seat.Price);
                _context.Tickets.Add(ticket);
                if (!limitLease.IsValid || !seatLease.IsValid)
                    return Fail("RESERVATION_LOCK_LOST", "Khóa đặt ghế đã hết hạn. Vui lòng thử lại.");
                for (var attempt = 0; ; attempt++)
                {
                    try
                    {
                        await _context.SaveChangesAsync(cancellationToken);
                        if (_catalogCache is not null) await _catalogCache.InvalidateAsync(CancellationToken.None);
                        break;
                    }
                    catch (DbUpdateException ex) when (attempt < 2 && IsOrderCodeConflict(ex))
                    {
                        ticket.RegenerateOrderCode();
                    }
                }
                var serverTime = _time.UtcNow;
                var expiresAt = serverTime.Add(holdDuration);
                try { _scheduler.Schedule(ticket.Id, holdDuration); }
                catch (Exception ex) { _logger.LogError(ex, "Reservation {TicketId} committed but expiry scheduling failed; stale-lock reconciliation remains active", ticket.Id); }
                try
                {
                    var versionToken = Convert.ToBase64String(seat.Version);
                    await _notifications.NotifySeatStatusChanged(eventId, seatId, seat.Status.ToString(), versionToken, expiresAt, userId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Reservation {TicketId} committed but public realtime notification failed", ticket.Id);
                }
                try
                {
                    await _notifications.NotifyOwnSeatLockChanged(
                        userId, eventId, seatId, seat.Status.ToString(), Convert.ToBase64String(seat.Version), expiresAt);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Reservation {TicketId} committed but private realtime notification failed", ticket.Id);
                }
                return new ReservationResult(true, "RESERVATION_CREATED", "Giữ ghế thành công.", ticket.Id, expiresAt, serverTime);
            }
            }
            catch (DbUpdateConcurrencyException)
            {
                return Fail("SEAT_VERSION_CONFLICT", "Trạng thái ghế đã thay đổi. Vui lòng chọn lại.");
            }
        }
    }

    public async Task<ReservationResult> ReserveBatchAsync(
        Guid eventId, 
        IReadOnlyList<Guid> seatIds, 
        Guid userId, 
        IReadOnlyDictionary<Guid, byte[]> seatVersions, 
        CancellationToken cancellationToken)
    {
        if (seatIds == null || seatIds.Count == 0)
            return Fail("INVALID_REQUEST", "Danh sách ghế không được để trống.");

        var orderedSeatIds = seatIds.Distinct().OrderBy(id => id).ToList();
        if (orderedSeatIds.Count is < 1 or > 4)
            return Fail("RESERVATION_LIMIT_REACHED", "Mỗi lần đặt vé chỉ được chọn từ 1 đến 4 ghế.");

        var limitKey = $"seat-limit:{userId}:{eventId}";
        var limitLease = await TryAcquireAsync(limitKey, TimeSpan.FromSeconds(30), cancellationToken);
        if (limitLease is null)
            return Fail("RESERVATION_LOCK_UNAVAILABLE", "Không thể khóa thao tác đặt vé lúc này. Vui lòng thử lại.");

        await using (limitLease)
        {
            var holdThreshold = _time.UtcNow.AddMinutes(-_options.HoldMinutes);
            var ev = await _context.Events.AsNoTracking().FirstOrDefaultAsync(e => e.Id == eventId, cancellationToken);
            var maxCap = ev?.MaxTicketsPerUser ?? _options.MaximumPendingSeatsPerEvent;

            var currentTicketsCount = await _context.Tickets.AsNoTracking().CountAsync(
                t => t.UserId == userId && t.EventId == eventId && 
                     (t.Status == TicketStatus.Paid || (t.Status == TicketStatus.Pending && t.CreatedAt > holdThreshold)),
                cancellationToken);

            if (currentTicketsCount + orderedSeatIds.Count > maxCap)
                return Fail("RESERVATION_LIMIT_REACHED", 
                    $"Mỗi khách chỉ được mua hoặc giữ tối đa {maxCap} vé cho sự kiện này (hiện bạn đã có {currentTicketsCount} vé/chỗ giữ).");

            var acquiredLeases = new List<IDistributedLockLease>();
            try
            {
                foreach (var sId in orderedSeatIds)
                {
                    var seatKey = $"seat:lock:{sId:N}";
                    var seatLease = await TryAcquireAsync(seatKey, TimeSpan.FromSeconds(30), cancellationToken);
                    if (seatLease is null)
                    {
                        return Fail("RESERVATION_LOCK_UNAVAILABLE", "Một trong các ghế bạn chọn đang được xử lý hoặc dịch vụ khóa tạm thời chưa sẵn sàng.");
                    }
                    acquiredLeases.Add(seatLease);
                }

                var seats = await _context.Seats.Include(s => s.Event)
                    .Where(s => orderedSeatIds.Contains(s.Id) && s.EventId == eventId)
                    .ToListAsync(cancellationToken);

                if (seats.Count != orderedSeatIds.Count)
                    return Fail("SEAT_NOT_FOUND", "Một số ghế được chọn không tồn tại.");

                var firstSeat = seats[0];
                if (firstSeat.Event == null || firstSeat.Event.IsDeleted || firstSeat.Event.Status != EventStatus.Published || firstSeat.Event.Date <= _time.UtcNow)
                    return Fail("EVENT_NOT_ON_SALE", "Sự kiện không còn mở bán.");

                var holdDuration = TimeSpan.FromMinutes(_options.HoldMinutes);

                // Verify all seats before mutating state
                foreach (var seat in seats)
                {
                    if (!seatVersions.TryGetValue(seat.Id, out var version) || version.Length == 0 || !seat.Version.SequenceEqual(version))
                        return Fail("SEAT_VERSION_CONFLICT", $"Trạng thái ghế {seat.Row}{seat.Number} đã thay đổi. Vui lòng chọn lại.");

                    var expired = seat.IsLockExpired(holdDuration, _time.UtcNow);
                    if (seat.Status != SeatStatus.Available && !expired)
                        return Fail("SEAT_UNAVAILABLE", $"Ghế {seat.Row}{seat.Number} đã được giữ hoặc bán.");
                }

                // Mutate seat locks and prepare tickets with one shared OrderCode
                var batchOrderCode = Ticket.GenerateOrderCode();
                var tickets = new List<Ticket>();

                foreach (var seat in seats)
                {
                    var expired = seat.IsLockExpired(holdDuration, _time.UtcNow);
                    if (expired)
                    {
                        var oldTickets = await _context.Tickets
                            .Where(t => t.SeatId == seat.Id && t.Status == TicketStatus.Pending)
                            .ToListAsync(cancellationToken);
                        foreach (var oldTicket in oldTickets) oldTicket.Cancel();
                        seat.ReclaimLock(userId, _time.UtcNow);
                    }
                    else
                    {
                        seat.Lock(userId, _time.UtcNow);
                    }

                    var ticket = new Ticket(eventId, seat.Id, userId, seat.Price, batchOrderCode);
                    _context.Tickets.Add(ticket);
                    tickets.Add(ticket);
                }

                if (!limitLease.IsValid || acquiredLeases.Any(l => !l.IsValid))
                    return Fail("RESERVATION_LOCK_LOST", "Khóa đặt ghế đã hết hạn. Vui lòng thử lại.");

                await _context.SaveChangesAsync(cancellationToken);
                if (_catalogCache is not null) await _catalogCache.InvalidateAsync(CancellationToken.None);

                var serverTime = _time.UtcNow;
                var expiresAt = serverTime.Add(holdDuration);

                foreach (var ticket in tickets)
                {
                    try { _scheduler.Schedule(ticket.Id, holdDuration); }
                    catch (Exception ex) { _logger.LogError(ex, "Reservation {TicketId} committed but expiry scheduling failed", ticket.Id); }
                }

                foreach (var seat in seats)
                {
                    try
                    {
                        var versionToken = Convert.ToBase64String(seat.Version);
                        await _notifications.NotifySeatStatusChanged(eventId, seat.Id, seat.Status.ToString(), versionToken, expiresAt, userId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Public realtime notification failed for seat {SeatId}", seat.Id);
                    }

                    try
                    {
                        await _notifications.NotifyOwnSeatLockChanged(
                            userId, eventId, seat.Id, seat.Status.ToString(), Convert.ToBase64String(seat.Version), expiresAt);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Private realtime notification failed for seat {SeatId}", seat.Id);
                    }
                }

                return new ReservationResult(
                    true, 
                    "RESERVATION_CREATED", 
                    "Giữ các ghế thành công.", 
                    tickets[0].Id, 
                    expiresAt, 
                    serverTime, 
                    batchOrderCode, 
                    tickets.Select(t => t.Id).ToList());
            }
            catch (DbUpdateConcurrencyException)
            {
                return Fail("SEAT_VERSION_CONFLICT", "Trạng thái một số ghế đã thay đổi. Vui lòng chọn lại.");
            }
            finally
            {
                foreach (var lease in acquiredLeases)
                {
                    try { await lease.DisposeAsync(); }
                    catch (Exception ex) { _logger.LogWarning(ex, "Error disposing seat lease"); }
                }
            }
        }
    }

    public async Task<ReservationResult> ReleaseAsync(Guid ticketId, Guid userId, string reason, CancellationToken cancellationToken)
        => await ReleaseCoreAsync(ticketId, userId, requireOwner: true, reason, cancellationToken);

    public async Task<ReservationResult> ExpireAsync(Guid ticketId, CancellationToken cancellationToken)
        => await ReleaseCoreAsync(ticketId, Guid.Empty, requireOwner: false, "reservation_expired", cancellationToken);

    private async Task<ReservationResult> ReleaseCoreAsync(Guid ticketId, Guid userId, bool requireOwner, string reason, CancellationToken cancellationToken)
    {
        var ticketInfo = await _context.Tickets.AsNoTracking()
            .Where(t => t.Id == ticketId)
            .Select(t => new { t.Id, t.SeatId, t.UserId, t.Status })
            .FirstOrDefaultAsync(cancellationToken);
        if (ticketInfo == null)
            return Fail("RESERVATION_NOT_FOUND", "Không tìm thấy lượt giữ ghế.");
        if (requireOwner && ticketInfo.UserId != userId)
            return Fail("RESERVATION_FORBIDDEN", "Bạn không có quyền hủy lượt giữ ghế này.");
        if (ticketInfo.Status != TicketStatus.Pending)
            return Fail("RESERVATION_NOT_PENDING", "Lượt giữ ghế không còn ở trạng thái chờ.");

        var lockKey = $"seat:lock:{ticketInfo.SeatId:N}";
        var lease = await TryAcquireAsync(lockKey, TimeSpan.FromSeconds(30), cancellationToken);
        if (lease is null)
            return Fail("RESERVATION_LOCK_UNAVAILABLE", "Không thể khóa thao tác hủy giữ ghế lúc này.");
        await using (lease)
        {
            var current = await _context.Tickets.Include(t => t.Seat)
                .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);
            if (current == null || (requireOwner && current.UserId != userId) || current.Status != TicketStatus.Pending)
                return Fail("RESERVATION_NOT_PENDING", "Lượt giữ ghế đã thay đổi.");

            var allPendingTickets = new List<Ticket> { current };
            if (current.OrderCode > 0)
            {
                var others = await _context.Tickets.Include(t => t.Seat)
                    .Where(t => t.OrderCode == current.OrderCode && t.Id != current.Id && t.Status == TicketStatus.Pending)
                    .ToListAsync(cancellationToken);
                allPendingTickets.AddRange(others);
            }

            var userEmail = string.Empty;
            if (requireOwner && userId != Guid.Empty)
            {
                userEmail = await _context.Users.AsNoTracking()
                    .Where(u => u.Id == userId)
                    .Select(u => u.Email)
                    .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;
            }

            var releasedSeats = new List<Seat>();
            foreach (var t in allPendingTickets)
            {
                var beforeSeatStatus = t.Seat?.Status;
                if (t.Seat?.Status == SeatStatus.Locked && (t.Seat.LockedByUserId == null || t.Seat.LockedByUserId == t.UserId))
                {
                    t.Seat.Release();
                    if (t.Seat != null) releasedSeats.Add(t.Seat);
                }

                _context.AuditLogs.Add(new AuditLog(
                    userId: requireOwner ? userId : null,
                    userEmail: userEmail,
                    action: "RESERVATION_RELEASED",
                    entityName: "Ticket",
                    entityId: t.Id.ToString(),
                    beforeState: $"Status={TicketStatus.Pending},SeatStatus={beforeSeatStatus}",
                    afterState: $"Status={TicketStatus.Cancelled},Reason={reason}"));
                t.Cancel();
            }

            if (!lease.IsValid) return Fail("RESERVATION_LOCK_LOST", "Khóa hủy giữ ghế đã hết hạn. Vui lòng thử lại.");
            try
            {
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                return Fail("RESERVATION_NOT_PENDING", "Lượt giữ ghế đã thay đổi.");
            }
            if (_catalogCache is not null) await _catalogCache.InvalidateAsync(CancellationToken.None);

            foreach (var seat in releasedSeats)
            {
                var versionToken = Convert.ToBase64String(seat.Version);
                try
                {
                    await _notifications.NotifySeatStatusChanged(
                        current.EventId, seat.Id, seat.Status.ToString(), versionToken);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Seat {SeatId} was released but realtime notification failed", seat.Id);
                }
            }

            return new ReservationResult(true, "RESERVATION_RELEASED", "Đã hủy lượt giữ ghế.");
        }
    }

    private async Task<IDistributedLockLease?> TryAcquireAsync(string key, TimeSpan duration, CancellationToken cancellationToken)
    {
        try { return await _locks.AcquireLockAsync(key, duration, cancellationToken); }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception ex) { _logger.LogWarning(ex, "Required reservation lock {LockKey} is unavailable", key); return null; }
    }

    private static ReservationResult Fail(string code, string message) => new(false, code, message);

    private static bool IsOrderCodeConflict(DbUpdateException exception) =>
        exception.ToString().Contains("IX_tickets_OrderCode", StringComparison.OrdinalIgnoreCase)
        || exception.ToString().Contains("OrderCode", StringComparison.OrdinalIgnoreCase);
}
