using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using TickeX.Application.Interfaces;
using TickeX.Application.Payments.Commands;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using TickeX.Infrastructure.Persistence;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Payments;

public class ConcurrencyAndPaymentTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ApplicationDbContext _context;

    public ConcurrencyAndPaymentTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        _context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options);
        _context.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public void PaymentTransaction_MarkSuccess_ShouldBeIdempotent()
    {
        // Arrange
        var tx = new PaymentTransaction(889911L, Guid.NewGuid(), 250000);

        // Act
        tx.MarkSuccess("TX12345", "{}");
        var firstProcessedAt = tx.ProcessedAt;

        // Second duplicate webhook call
        tx.MarkSuccess("TX12345", "{}");

        // Assert
        tx.Status.Should().Be("Success");
        tx.ProviderTransactionId.Should().Be("TX12345");
        tx.Amount.Should().Be(250000);
    }

    [Fact]
    public void PaymentTransaction_MarkRefundInitiated_And_MarkRefunded_ShouldTransitionProperly()
    {
        // Arrange
        var tx = new PaymentTransaction(889911L, Guid.NewGuid(), 500000);
        tx.MarkSuccess("TX99999", "{}");

        // Act
        tx.MarkRefundInitiated("Refund request received");
        tx.Status.Should().Be("RefundInitiated");

        tx.MarkRefunded("REFUND_TX_001", "Refund completed");

        // Assert
        tx.Status.Should().Be("Refunded");
        tx.ProviderTransactionId.Should().Be("REFUND_TX_001");
    }

    [Fact]
    public void PaymentTransaction_MarkOrphaned_ShouldFlagCompensationState()
    {
        // Arrange
        var tx = new PaymentTransaction(778899L, Guid.NewGuid(), 350000);

        // Act
        tx.MarkOrphaned("Hold expired: Cancelled", "PAYOS_TX_999", "{\"code\":\"00\"}");

        // Assert
        tx.Status.Should().Be("OrphanedPaid");
        tx.ProviderTransactionId.Should().Be("PAYOS_TX_999");
        tx.RawWebhookPayload.Should().Contain("Hold expired: Cancelled");
        tx.Amount.Should().Be(350000);
    }

    [Fact]
    public async Task ProcessPayment_WhenSeatLockContended_ShouldDisposeAcquiredEventLockLease()
    {
        // Arrange
        var user = new User("User", "user@test.local", "hash");
        var ev = new Event("Concert", "Desc", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(3), "Loc", "Venue", 1, "Music", basePrice: 100000);
        ev.GenerateSeatsMatrix(1, 1);
        _context.AddRange(user, ev);
        await _context.SaveChangesAsync();

        var seat = await _context.Seats.FirstAsync();
        seat.Lock(user.Id);
        var ticket = new Ticket(ev.Id, seat.Id, user.Id, seat.Price);
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        var eventLeaseMock = new Mock<IDistributedLockLease>();
        eventLeaseMock.SetupGet(x => x.IsValid).Returns(true);
        eventLeaseMock.Setup(x => x.DisposeAsync()).Returns(ValueTask.CompletedTask);

        var lockService = new Mock<IDistributedLockService>();
        lockService.Setup(x => x.AcquireLockAsync($"event:cancel:{ev.Id:N}", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(eventLeaseMock.Object);
        // Seat lock fails (returns null or throws)
        lockService.Setup(x => x.AcquireLockAsync($"seat:lock:{seat.Id:N}", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((IDistributedLockLease?)null);

        var notifications = new Mock<ISeatNotificationService>();
        var outbox = new Mock<INotificationOutboxPort>();
        var ticketSecurity = new Mock<ITicketSecurityService>();

        var handler = new ProcessPaymentCommandHandler(
            _context, outbox.Object, notifications.Object, lockService.Object,
            ticketSecurity.Object, NullLogger<ProcessPaymentCommandHandler>.Instance);

        var webhookData = new PayOSWebhookData
        {
            OrderCode = ticket.OrderCode,
            Amount = ticket.Price,
            Success = true,
            Reference = "payos-ref",
            Code = "00"
        };

        // Act
        var result = await handler.Handle(new ProcessPaymentCommand(webhookData), CancellationToken.None);

        // Assert
        result.Should().BeFalse();
        // Invariant: The acquired event lock lease MUST be disposed even when subsequent lock acquisitions fail
        eventLeaseMock.Verify(x => x.DisposeAsync(), Times.Once);
    }

    [Fact]
    public async Task ProcessPayment_WhenPaymentLockContended_ShouldDisposeBothEventAndSeatLockLeases()
    {
        // Arrange
        var user = new User("User", "user@test.local", "hash");
        var ev = new Event("Concert", "Desc", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(3), "Loc", "Venue", 1, "Music", basePrice: 100000);
        ev.GenerateSeatsMatrix(1, 1);
        _context.AddRange(user, ev);
        await _context.SaveChangesAsync();

        var seat = await _context.Seats.FirstAsync();
        seat.Lock(user.Id);
        var ticket = new Ticket(ev.Id, seat.Id, user.Id, seat.Price);
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        var eventLeaseMock = new Mock<IDistributedLockLease>();
        eventLeaseMock.SetupGet(x => x.IsValid).Returns(true);
        eventLeaseMock.Setup(x => x.DisposeAsync()).Returns(ValueTask.CompletedTask);

        var seatLeaseMock = new Mock<IDistributedLockLease>();
        seatLeaseMock.SetupGet(x => x.IsValid).Returns(true);
        seatLeaseMock.Setup(x => x.DisposeAsync()).Returns(ValueTask.CompletedTask);

        var lockService = new Mock<IDistributedLockService>();
        lockService.Setup(x => x.AcquireLockAsync($"event:cancel:{ev.Id:N}", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(eventLeaseMock.Object);
        lockService.Setup(x => x.AcquireLockAsync($"seat:lock:{seat.Id:N}", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(seatLeaseMock.Object);
        // Payment lock fails
        lockService.Setup(x => x.AcquireLockAsync($"payment:lock:{ticket.OrderCode}", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((IDistributedLockLease?)null);

        var notifications = new Mock<ISeatNotificationService>();
        var outbox = new Mock<INotificationOutboxPort>();
        var ticketSecurity = new Mock<ITicketSecurityService>();

        var handler = new ProcessPaymentCommandHandler(
            _context, outbox.Object, notifications.Object, lockService.Object,
            ticketSecurity.Object, NullLogger<ProcessPaymentCommandHandler>.Instance);

        var webhookData = new PayOSWebhookData
        {
            OrderCode = ticket.OrderCode,
            Amount = ticket.Price,
            Success = true,
            Reference = "payos-ref",
            Code = "00"
        };

        // Act
        var result = await handler.Handle(new ProcessPaymentCommand(webhookData), CancellationToken.None);

        // Assert
        result.Should().BeFalse();
        eventLeaseMock.Verify(x => x.DisposeAsync(), Times.Once);
        seatLeaseMock.Verify(x => x.DisposeAsync(), Times.Once);
    }

    [Fact]
    public async Task ProcessPayment_WithAppliedCoupon_ValidatesDiscountedPriceAndRedeemsCoupon()
    {
        // Arrange
        var user = new User("UserCoupon", "usercoupon@test.local", "hash");
        var ev = new Event("Concert Coupon", "Desc", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(3), "Loc", "Venue", 1, "Music", basePrice: 200000);
        ev.GenerateSeatsMatrix(1, 1);
        _context.AddRange(user, ev);
        await _context.SaveChangesAsync();

        var seat = ev.Seats.First();
        seat.Lock(user.Id, DateTime.UtcNow);

        var coupon = new Coupon(
            code: "PROMO50",
            description: "Giảm 50k",
            discountType: DiscountType.FixedAmount,
            discountValue: 50000,
            maxDiscountAmount: null,
            minOrderAmount: 0,
            usageLimit: 5,
            validFrom: DateTime.UtcNow.AddDays(-1),
            validTo: DateTime.UtcNow.AddDays(1)
        );
        _context.Coupons.Add(coupon);

        var ticket = new Ticket(ev.Id, seat.Id, user.Id, seat.Price, 776655L);
        _context.Tickets.Add(ticket);

        // Payment transaction recorded with coupon discount: 200k - 50k = 150k
        var tx = new PaymentTransaction(ticket.OrderCode, ticket.Id, 150000, "VietQR_PayOS", "PROMO50", 50000);
        _context.PaymentTransactions.Add(tx);
        await _context.SaveChangesAsync();

        var eventLeaseMock = new Mock<IDistributedLockLease>();
        eventLeaseMock.SetupGet(x => x.IsValid).Returns(true);
        var seatLeaseMock = new Mock<IDistributedLockLease>();
        seatLeaseMock.SetupGet(x => x.IsValid).Returns(true);
        var paymentLeaseMock = new Mock<IDistributedLockLease>();
        paymentLeaseMock.SetupGet(x => x.IsValid).Returns(true);

        var lockService = new Mock<IDistributedLockService>();
        lockService.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(eventLeaseMock.Object);

        var notifications = new Mock<ISeatNotificationService>();
        var outbox = new Mock<INotificationOutboxPort>();
        var ticketSecurity = new Mock<ITicketSecurityService>();
        ticketSecurity.Setup(x => x.GenerateSignedQrToken(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<long>(), It.IsAny<DateTime>(), It.IsAny<string>()))
            .Returns("SIGNED_QR_TOKEN");

        var handler = new ProcessPaymentCommandHandler(
            _context, outbox.Object, notifications.Object, lockService.Object,
            ticketSecurity.Object, NullLogger<ProcessPaymentCommandHandler>.Instance);

        var webhookData = new PayOSWebhookData
        {
            OrderCode = ticket.OrderCode,
            Amount = 150000, // Discounted price paid!
            Success = true,
            Reference = "payos-coupon-ref",
            Code = "00"
        };

        // Act
        var result = await handler.Handle(new ProcessPaymentCommand(webhookData), CancellationToken.None);

        // Assert
        result.Should().BeTrue();

        var reloadedCoupon = await _context.Coupons.FirstAsync(c => c.Code == "PROMO50");
        reloadedCoupon.UsedCount.Should().Be(1); // Atomically redeemed!

        var reloadedTicket = await _context.Tickets.FindAsync(ticket.Id);
        reloadedTicket!.Status.Should().Be(TicketStatus.Paid);

        var reloadedTx = await _context.PaymentTransactions.FirstAsync(p => p.OrderCode == ticket.OrderCode);
        reloadedTx.Status.Should().Be("Success");
    }
}
