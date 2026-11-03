using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Settlements.Commands;
using TickeX.Application.Settlements.Queries;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using TickeX.Infrastructure.Persistence;
using Xunit;

namespace TickeX.UnitTests.Settlements;

public sealed class SettlementEngineTests : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    private readonly ApplicationDbContext _context;

    public SettlementEngineTests()
    {
        _connection.Open();
        _context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options);
        _context.Database.EnsureCreated();
    }

    private async Task<(Event ev, User organizer, User customer)> SeedSettlementDataAsync(
        decimal ticketPrice = 1_000_000m,
        int paidCount = 10,
        int refundedCount = 1)
    {
        var organizer = new User("Music Org", "music@org.com", "hash", "Organizer");
        var customer = new User("Fan", "fan@test.com", "hash", "Customer");
        _context.Users.AddRange(organizer, customer);
        await _context.SaveChangesAsync();

        var ev = new Event(
            "Rock Fest 2026", "Desc", DateTime.UtcNow.AddDays(10), DateTime.UtcNow.AddDays(10).AddHours(4),
            "Ha Noi", "My Dinh", paidCount + refundedCount, "Music", basePrice: ticketPrice, organizerId: organizer.Id);
        ev.GenerateSeatsMatrix(1, paidCount + refundedCount);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var seats = ev.Seats.ToList();

        // Paid tickets
        for (int i = 0; i < paidCount; i++)
        {
            var ticket = new Ticket(ev.Id, seats[i].Id, customer.Id, ticketPrice);
            ticket.MarkAsPaid($"SIG_{i}");
            _context.Tickets.Add(ticket);
        }

        // Refunded tickets
        for (int i = paidCount; i < paidCount + refundedCount; i++)
        {
            var ticket = new Ticket(ev.Id, seats[i].Id, customer.Id, ticketPrice);
            ticket.MarkAsPaid($"SIG_REF_{i}");
            ticket.Refund(ticketPrice);
            _context.Tickets.Add(ticket);
        }

        await _context.SaveChangesAsync();
        return (ev, organizer, customer);
    }

    [Fact]
    public async Task RequestSettlement_Calculates5PercentCommissionAndDeductsRefunds()
    {
        // 10 paid tickets of 1,000,000 = 10,000,000 gross
        // 1 refunded ticket of 1,000,000 = 1,000,000 refund deduction
        var (ev, organizer, _) = await SeedSettlementDataAsync(1_000_000m, paidCount: 10, refundedCount: 1);

        var handler = new RequestSettlementCommandHandler(_context);
        var result = await handler.Handle(new RequestSettlementCommand(
            ev.Id,
            organizer.Id,
            "Vietcombank",
            "0011001234567",
            "CONG TY TNHH AM NHAC"
        ), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.SettlementId.Should().NotBeNull();
        // Gross: 10,000,000. Commission 5%: 500,000. Refund: 1,000,000. Net: 8,500,000.
        result.NetPayout.Should().Be(8_500_000m);

        var savedSettlement = await _context.Settlements.FindAsync(result.SettlementId);
        savedSettlement.Should().NotBeNull();
        savedSettlement!.GrossRevenue.Should().Be(10_000_000m);
        savedSettlement.CommissionRate.Should().Be(0.05m);
        savedSettlement.CommissionAmount.Should().Be(500_000m);
        savedSettlement.RefundDeduction.Should().Be(1_000_000m);
        savedSettlement.NetPayout.Should().Be(8_500_000m);
        savedSettlement.Status.Should().Be(SettlementStatus.Pending);
    }

    [Fact]
    public async Task RequestSettlement_WhenAlreadyPending_RejectsDuplicate()
    {
        var (ev, organizer, _) = await SeedSettlementDataAsync();

        var handler = new RequestSettlementCommandHandler(_context);
        var cmd = new RequestSettlementCommand(ev.Id, organizer.Id, "VCB", "123", "HOLDER");

        var first = await handler.Handle(cmd, CancellationToken.None);
        first.Success.Should().BeTrue();

        var second = await handler.Handle(cmd, CancellationToken.None);
        second.Success.Should().BeFalse();
        second.Code.Should().Be("SETTLEMENT_ALREADY_PENDING");
    }

    [Fact]
    public async Task RequestSettlement_WhenConcurrentRaceConditionOccurs_FilteredUniqueIndexPreventsDuplicate()
    {
        var (ev, organizer, _) = await SeedSettlementDataAsync();

        // Simulate concurrent insert that bypassed the pre-check
        var concurrentSettlement = new Settlement(
            ev.Id, organizer.Id, 10_000_000m, 0.05m, 1_000_000m, "VCB", "123", "HOLDER"
        );
        _context.Settlements.Add(concurrentSettlement);
        await _context.SaveChangesAsync();

        // Directly invoke handler with a separate context or bypass pre-check
        // Because concurrentSettlement is in DB with Status = Pending (0),
        // another attempt with same EventId will either be blocked by pre-check or unique index.
        var handler = new RequestSettlementCommandHandler(_context);
        var cmd = new RequestSettlementCommand(ev.Id, organizer.Id, "VCB", "123", "HOLDER");

        var result = await handler.Handle(cmd, CancellationToken.None);
        result.Success.Should().BeFalse();
        result.Code.Should().Be("SETTLEMENT_ALREADY_PENDING");

        // Verify database unique index physically rejects second active settlement
        var duplicateAttempt = new Settlement(
            ev.Id, organizer.Id, 10_000_000m, 0.05m, 1_000_000m, "BIDV", "456", "HOLDER2"
        );
        _context.Settlements.Add(duplicateAttempt);
        var act = () => _context.SaveChangesAsync();
        await act.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task RequestSettlement_WhenCallerNotOrganizer_ReturnsForbidden()
    {
        var (ev, _, _) = await SeedSettlementDataAsync();
        var imposterId = Guid.NewGuid();

        var handler = new RequestSettlementCommandHandler(_context);
        var result = await handler.Handle(new RequestSettlementCommand(
            ev.Id, imposterId, "VCB", "123", "HOLDER"
        ), CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Code.Should().Be("FORBIDDEN");
    }

    [Fact]
    public async Task ApproveAndCompleteSettlement_TransitionsStateCleanly()
    {
        var (ev, organizer, _) = await SeedSettlementDataAsync();

        var reqHandler = new RequestSettlementCommandHandler(_context);
        var reqResult = await reqHandler.Handle(new RequestSettlementCommand(
            ev.Id, organizer.Id, "VCB", "123", "HOLDER"
        ), CancellationToken.None);

        var settlementId = reqResult.SettlementId!.Value;
        var adminId = Guid.NewGuid();
        var adminHandler = new SettlementAdminCommandHandler(_context);

        // Approve
        var approveResult = await adminHandler.Handle(
            new ApproveSettlementCommand(settlementId, adminId, "Đã đối soát số liệu khớp 100%"),
            CancellationToken.None);
        approveResult.Success.Should().BeTrue();

        var approved = await _context.Settlements.FindAsync(settlementId);
        approved!.Status.Should().Be(SettlementStatus.Approved);
        approved.AdminNote.Should().Be("Đã đối soát số liệu khớp 100%");

        // Complete with bank transaction ref
        var completeResult = await adminHandler.Handle(
            new CompleteSettlementCommand(settlementId, adminId, "FT260012345", "Chuyển khoản thành công"),
            CancellationToken.None);
        completeResult.Success.Should().BeTrue();

        var completed = await _context.Settlements.FindAsync(settlementId);
        completed!.Status.Should().Be(SettlementStatus.Completed);
        completed.AdminNote.Should().Contain("FT260012345");
        completed.ProcessedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task RejectSettlement_TransitionsToRejectedWithReason()
    {
        var (ev, organizer, _) = await SeedSettlementDataAsync();

        var reqHandler = new RequestSettlementCommandHandler(_context);
        var reqResult = await reqHandler.Handle(new RequestSettlementCommand(
            ev.Id, organizer.Id, "VCB", "123", "HOLDER"
        ), CancellationToken.None);

        var settlementId = reqResult.SettlementId!.Value;
        var adminHandler = new SettlementAdminCommandHandler(_context);

        var rejectResult = await adminHandler.Handle(
            new RejectSettlementCommand(settlementId, Guid.NewGuid(), "Tài khoản thụ hưởng không chính xác"),
            CancellationToken.None);

        rejectResult.Success.Should().BeTrue();

        var rejected = await _context.Settlements.FindAsync(settlementId);
        rejected!.Status.Should().Be(SettlementStatus.Rejected);
        rejected.AdminNote.Should().Be("Tài khoản thụ hưởng không chính xác");
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }
}

