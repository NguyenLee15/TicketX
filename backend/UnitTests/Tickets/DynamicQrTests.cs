using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;
using TickeX.Application.Interfaces;
using TickeX.Application.Tickets.Commands;
using TickeX.Application.Tickets.Queries;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using TickeX.Infrastructure.Persistence;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Tickets;

public sealed class DynamicQrTests : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    private readonly ApplicationDbContext _context;
    private readonly TotpService _totpService = new("TickeX-Test-Dynamic-QR-Secret-2026");

    public DynamicQrTests()
    {
        _connection.Open();
        _context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options);
        _context.Database.EnsureCreated();
    }

    private async Task<(Event ev, Seat seat, User user, Ticket ticket)> SeedTicketAsync(
        TicketStatus status = TicketStatus.Paid,
        DateTime? eventDate = null,
        DateTime? eventEndDate = null)
    {
        var ev = new Event(
            "Live Concert 2026",
            "Great concert",
            eventDate ?? DateTime.UtcNow.AddMinutes(-30),
            eventEndDate ?? DateTime.UtcNow.AddHours(2),
            "Hanoi Stadium",
            "Stadium A",
            100,
            "Concert",
            basePrice: 500000m
        );
        ev.GenerateSeatsMatrix(1, 1);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var seat = ev.Seats.First();

        var user = new User("John Doe", "john@example.com", "hash", "Customer");
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var ticket = new Ticket(ev.Id, seat.Id, user.Id, 500000m);
        if (status == TicketStatus.Paid)
        {
            ticket.MarkAsPaid();
        }
        else if (status == TicketStatus.Used)
        {
            ticket.MarkAsPaid();
            ticket.CheckIn();
        }
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        return (ev, seat, user, ticket);
    }

    [Fact]
    public void GenerateDynamicToken_ProducesStandardFormattedToken()
    {
        var ticketId = Guid.NewGuid();
        var token = _totpService.GenerateDynamicToken(ticketId);

        token.Should().StartWith("TICKEX-TOTP:");
        var parts = token.Split(':');
        parts.Length.Should().Be(4);
        parts[1].Should().Be(ticketId.ToString("N"));
        parts[2].Length.Should().Be(6); // 6-digit OTP
        parts[3].Length.Should().Be(16); // 16-hex signature
    }

    [Fact]
    public void ValidateDynamicToken_WithValidToken_ReturnsTrueAndCorrectTicketId()
    {
        var ticketId = Guid.NewGuid();
        var token = _totpService.GenerateDynamicToken(ticketId);

        var (isValid, validatedTicketId, error) = _totpService.ValidateDynamicToken(token);

        isValid.Should().BeTrue();
        validatedTicketId.Should().Be(ticketId);
        error.Should().BeNull();
    }

    [Fact]
    public void ValidateDynamicToken_WithTamperedSignature_ReturnsFalse()
    {
        var ticketId = Guid.NewGuid();
        var token = _totpService.GenerateDynamicToken(ticketId);
        var tamperedToken = token[..^4] + "dead";

        var (isValid, _, error) = _totpService.ValidateDynamicToken(tamperedToken);

        isValid.Should().BeFalse();
        error.Should().Contain("Chữ ký");
    }

    [Fact]
    public void ValidateDynamicToken_WhenExpiredBeyondTolerance_ReturnsFalse()
    {
        var ticketId = Guid.NewGuid();
        var baseTime = new DateTime(2026, 6, 1, 10, 0, 0, DateTimeKind.Utc);
        var oldToken = _totpService.GenerateDynamicToken(ticketId, baseTime);

        // Advance time by 90 seconds (3 time steps)
        var futureTime = baseTime.AddSeconds(90);
        var (isValid, _, error) = _totpService.ValidateDynamicToken(oldToken, futureTime);

        isValid.Should().BeFalse();
        error.Should().Contain("hết hạn");
    }

    [Fact]
    public void ValidateDynamicToken_WithinOneStepSkewTolerance_ReturnsTrue()
    {
        var ticketId = Guid.NewGuid();
        var baseTime = new DateTime(2026, 6, 1, 10, 0, 0, DateTimeKind.Utc);
        var token = _totpService.GenerateDynamicToken(ticketId, baseTime);

        // 25 seconds later (same or next step within 1-step window)
        var skewedTime = baseTime.AddSeconds(25);
        var (isValid, validatedTicketId, _) = _totpService.ValidateDynamicToken(token, skewedTime);

        isValid.Should().BeTrue();
        validatedTicketId.Should().Be(ticketId);
    }

    [Fact]
    public async Task GetDynamicQrQuery_ReturnsQrWhenAuthorizedOwner()
    {
        var (_, _, user, ticket) = await SeedTicketAsync();

        var handler = new GetDynamicQrQueryHandler(_context, _totpService);
        var result = await handler.Handle(new GetDynamicQrQuery(ticket.Id, user.Id), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.TicketId.Should().Be(ticket.Id);
        result.Data.QrToken.Should().StartWith("TICKEX-TOTP:");
        result.Data.StepSeconds.Should().Be(30);
    }

    [Fact]
    public async Task GetDynamicQrQuery_FailsWhenNotOwnerAndNotAdmin()
    {
        var (_, _, _, ticket) = await SeedTicketAsync();
        var unauthorizedUserId = Guid.NewGuid();

        var handler = new GetDynamicQrQueryHandler(_context, _totpService);
        var result = await handler.Handle(new GetDynamicQrQuery(ticket.Id, unauthorizedUserId, IsAdmin: false), CancellationToken.None);

        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be("FORBIDDEN");
    }

    [Fact]
    public async Task CheckInTicket_WithValidDynamicTotpToken_Succeeds()
    {
        var (_, _, _, ticket) = await SeedTicketAsync();

        var dynamicToken = _totpService.GenerateDynamicToken(ticket.Id);

        var mockSecurity = new Mock<ITicketSecurityService>();
        var handler = new CheckInTicketCommandHandler(_context, mockSecurity.Object, totpService: _totpService);

        var result = await handler.Handle(
            new CheckInTicketCommand(dynamicToken, Guid.NewGuid(), StaffRole: "Admin"),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().ContainEquivalentOf("thành công");

        var updatedTicket = await _context.Tickets.FindAsync(ticket.Id);
        updatedTicket!.Status.Should().Be(TicketStatus.Used);
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }
}
