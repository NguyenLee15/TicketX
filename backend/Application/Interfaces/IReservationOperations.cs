namespace TickeX.Application.Interfaces;

public sealed record ReservationResult(
    bool Success,
    string Code,
    string Message,
    Guid? TicketId = null,
    DateTime? ExpiresAt = null,
    DateTime? ServerTime = null,
    long? OrderCode = null,
    IReadOnlyList<Guid>? TicketIds = null);

public interface IReservationOperations
{
    Task<ReservationResult> ReserveAsync(Guid eventId, Guid seatId, Guid userId, byte[] version, CancellationToken cancellationToken);
    Task<ReservationResult> ReserveBatchAsync(Guid eventId, IReadOnlyList<Guid> seatIds, Guid userId, IReadOnlyDictionary<Guid, byte[]> seatVersions, CancellationToken cancellationToken);
    Task<ReservationResult> ReleaseAsync(Guid ticketId, Guid userId, string reason, CancellationToken cancellationToken);
    Task<ReservationResult> ExpireAsync(Guid ticketId, CancellationToken cancellationToken);
}
