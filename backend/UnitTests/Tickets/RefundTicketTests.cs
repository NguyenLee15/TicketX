using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;
using TickeX.Application.Interfaces;
using TickeX.Application.Tickets.Commands;
using TickeX.Domain.Entities;
using TickeX.Infrastructure.Persistence;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Tickets;

public sealed class RefundTicketTests : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    private readonly ApplicationDbContext _context;

    public RefundTicketTests()
    {
        _connection.Open();
        _context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options);
        _context.Database.EnsureCreated();
    }

    [Fact]
    public async Task Handle_WhenDistributedLockIsUnavailable_FailsClosedWithoutMutation()
    {
        var lockService = new Mock<IDistributedLockService>();
        lockService
            .Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Redis unavailable"));

        var handler = new RefundTicketCommandHandler(_context, lockService.Object, new RefundRequestPort(_context));

        var result = await handler.Handle(
            new RefundTicketCommand(Guid.NewGuid(), Guid.NewGuid()),
            CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Code.Should().Be("REFUND_LOCK_UNAVAILABLE");
        _context.ChangeTracker.HasChanges().Should().BeFalse();
    }

    [Fact]
    public async Task Handle_WhenBetween24And48Hours_Calculates70PercentRefund()
    {
        var ev = new Event(
            "Tiered Concert",
            "Tiered",
            DateTime.UtcNow.AddHours(36), // 36 hours before
            DateTime.UtcNow.AddHours(40),
            "Ha Noi",
            "My Dinh",
            100,
            "Music",
            basePrice: 1_000_000m,
            refundCutoffHours: 24
        );
        ev.GenerateSeatsMatrix(1, 1);
        _context.Events.Add(ev);

        var user = new User("Refund Tester", "tester@test.com", "hash", "Customer");
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var seat = ev.Seats.First();
        var ticket = new Ticket(ev.Id, seat.Id, user.Id, 1_000_000m);
        ticket.MarkAsPaid("SIG");
        _context.Tickets.Add(ticket);

        var bankAccount = new RefundBankAccount(user.Id, "encrypted_payload", "5678");
        _context.RefundBankAccounts.Add(bankAccount);
        await _context.SaveChangesAsync();

        var leaseMock = new Mock<IDistributedLockLease>();
        leaseMock.Setup(l => l.IsValid).Returns(true);

        var lockService = new Mock<IDistributedLockService>();
        lockService
            .Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(leaseMock.Object);

        var refundPort = new Mock<IRefundRequestPort>();
        refundPort
            .Setup(p => p.EnqueueAsync(It.IsAny<IReadOnlyCollection<RefundEnqueueItem>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RefundEnqueueResult.Created);

        var handler = new RefundTicketCommandHandler(_context, lockService.Object, refundPort.Object);

        var result = await handler.Handle(
            new RefundTicketCommand(ticket.Id, user.Id),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        result.RefundAmount.Should().Be(700_000m);
        result.Message.Should().Contain("70%");

        refundPort.Verify(p => p.EnqueueAsync(
            It.Is<IReadOnlyCollection<RefundEnqueueItem>>(items => items.First().Amount == 700_000m),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenMoreThan48Hours_Calculates100PercentRefund()
    {
        var ev = new Event(
            "100 Percent Concert",
            "Full Refund",
            DateTime.UtcNow.AddHours(60), // 60 hours before
            DateTime.UtcNow.AddHours(64),
            "Ha Noi",
            "My Dinh",
            100,
            "Music",
            basePrice: 1_000_000m,
            refundCutoffHours: 24
        );
        ev.GenerateSeatsMatrix(1, 1);
        _context.Events.Add(ev);

        var user = new User("Full Refund Tester", "full@test.com", "hash", "Customer");
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var seat = ev.Seats.First();
        var ticket = new Ticket(ev.Id, seat.Id, user.Id, 1_000_000m);
        ticket.MarkAsPaid("SIG");
        _context.Tickets.Add(ticket);

        var bankAccount = new RefundBankAccount(user.Id, "encrypted_payload", "5678");
        _context.RefundBankAccounts.Add(bankAccount);
        await _context.SaveChangesAsync();

        var leaseMock = new Mock<IDistributedLockLease>();
        leaseMock.Setup(l => l.IsValid).Returns(true);

        var lockService = new Mock<IDistributedLockService>();
        lockService
            .Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(leaseMock.Object);

        var refundPort = new Mock<IRefundRequestPort>();
        refundPort
            .Setup(p => p.EnqueueAsync(It.IsAny<IReadOnlyCollection<RefundEnqueueItem>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RefundEnqueueResult.Created);

        var handler = new RefundTicketCommandHandler(_context, lockService.Object, refundPort.Object);

        var result = await handler.Handle(
            new RefundTicketCommand(ticket.Id, user.Id),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        result.RefundAmount.Should().Be(1_000_000m);
        result.Message.Should().Contain("100%");

        refundPort.Verify(p => p.EnqueueAsync(
            It.Is<IReadOnlyCollection<RefundEnqueueItem>>(items => items.First().Amount == 1_000_000m),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }
}
