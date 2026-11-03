using MediatR;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Seats.Commands;

public record LockSeatsBatchCommand(
    Guid EventId,
    IReadOnlyList<Guid> SeatIds,
    Guid UserId,
    IReadOnlyDictionary<Guid, byte[]> SeatVersions) : IRequest<ReservationResult>;

