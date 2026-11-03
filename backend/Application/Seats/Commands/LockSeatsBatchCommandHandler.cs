using MediatR;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Seats.Commands;

public sealed class LockSeatsBatchCommandHandler : IRequestHandler<LockSeatsBatchCommand, ReservationResult>
{
    private readonly IReservationOperations _operations;
    public LockSeatsBatchCommandHandler(IReservationOperations operations) => _operations = operations;
    public Task<ReservationResult> Handle(LockSeatsBatchCommand request, CancellationToken cancellationToken) =>
        _operations.ReserveBatchAsync(request.EventId, request.SeatIds, request.UserId, request.SeatVersions, cancellationToken);
}

