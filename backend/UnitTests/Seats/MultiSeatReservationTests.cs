using FluentAssertions;
using TickeX.Application.Seats.Commands;
using TickeX.Domain.Entities;
using Xunit;

namespace TickeX.UnitTests.Seats;

public class MultiSeatReservationTests
{
    private readonly LockSeatsBatchCommandValidator _validator = new();

    [Fact]
    public void Validator_ShouldFail_WhenSeatIdsIsEmpty()
    {
        var command = new LockSeatsBatchCommand(
            Guid.NewGuid(), 
            new List<Guid>(), 
            Guid.NewGuid(), 
            new Dictionary<Guid, byte[]>());

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "SeatIds");
    }

    [Fact]
    public void Validator_ShouldFail_WhenSeatIdsExceedsMaxBatchOf4()
    {
        var seatIds = Enumerable.Range(0, 5).Select(_ => Guid.NewGuid()).ToList();
        var versions = seatIds.ToDictionary(id => id, _ => Guid.NewGuid().ToByteArray());
        var command = new LockSeatsBatchCommand(Guid.NewGuid(), seatIds, Guid.NewGuid(), versions);

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("từ 1 đến 4 ghế"));
    }

    [Fact]
    public void Validator_ShouldFail_WhenSeatIdsContainsDuplicates()
    {
        var duplicateSeat = Guid.NewGuid();
        var seatIds = new List<Guid> { duplicateSeat, duplicateSeat };
        var versions = new Dictionary<Guid, byte[]> { [duplicateSeat] = Guid.NewGuid().ToByteArray() };
        var command = new LockSeatsBatchCommand(Guid.NewGuid(), seatIds, Guid.NewGuid(), versions);

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("không được trùng lặp"));
    }

    [Fact]
    public void Validator_ShouldPass_WhenBatchHas1To4DistinctSeatsWithValidTokens()
    {
        var seatIds = new List<Guid> { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };
        var versions = seatIds.ToDictionary(id => id, _ => Guid.NewGuid().ToByteArray());
        var command = new LockSeatsBatchCommand(Guid.NewGuid(), seatIds, Guid.NewGuid(), versions);

        var result = _validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Event_MaxTicketsPerUser_ShouldDefaultTo4_AndAllowCustomCap()
    {
        var ev = new Event("Concert", "Desc", DateTime.UtcNow.AddDays(7), DateTime.UtcNow.AddDays(7).AddHours(3),
            "Hanoi", "My Dinh", 100);

        ev.MaxTicketsPerUser.Should().Be(4);

        ev.Update("Concert 2", "Desc 2", DateTime.UtcNow.AddDays(7), DateTime.UtcNow.AddDays(7).AddHours(3),
            "Hanoi", "My Dinh", 100, "Concert", "", "", "TickeX Live", 200000m,
            TickeX.Domain.Enums.EventStatus.Published, 24, maxTicketsPerUser: 6);

        ev.MaxTicketsPerUser.Should().Be(6);
    }

    [Fact]
    public void Tickets_InBatch_ShouldShareCommonOrderCode()
    {
        var eventId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var batchOrderCode = Ticket.GenerateOrderCode();

        var ticket1 = new Ticket(eventId, Guid.NewGuid(), userId, 200000m, batchOrderCode);
        var ticket2 = new Ticket(eventId, Guid.NewGuid(), userId, 350000m, batchOrderCode);

        ticket1.OrderCode.Should().Be(batchOrderCode);
        ticket2.OrderCode.Should().Be(batchOrderCode);
        ticket1.Id.Should().NotBe(ticket2.Id);
    }
}

