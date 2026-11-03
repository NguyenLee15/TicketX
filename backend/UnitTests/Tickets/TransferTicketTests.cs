using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;
using TickeX.Application.Interfaces;
using TickeX.Application.Tickets.Commands;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using TickeX.Infrastructure.Persistence;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Tickets;

public sealed class TransferTicketTests : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    private readonly ApplicationDbContext _context;
    private readonly Mock<ITicketSecurityService> _securityService = new();
    private readonly Mock<IEmailService> _emailService = new();

    public TransferTicketTests()
    {
        _connection.Open();
        _context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options);
        _context.Database.EnsureCreated();

        _securityService
            .Setup(s => s.GenerateSignedQrToken(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<long>(), It.IsAny<DateTime>(), It.IsAny<string>()))
            .Returns("NEW-SIGNED-QR-TOKEN-FOR-RECIPIENT");
    }

    private async Task<(Event ev, Seat seat, User owner, User recipient, Ticket ticket)> SeedTransferScenarioAsync(
        TicketStatus status = TicketStatus.Paid,
        DateTime? eventDate = null)
    {
        var ev = new Event(
            "Transfer Rock Concert",
            "Rock concert",
            eventDate ?? DateTime.UtcNow.AddDays(7),
            DateTime.UtcNow.AddDays(7).AddHours(3),
            "Ha Noi",
            "My Dinh",
            100,
            "Music",
            basePrice: 500000m
        );
        ev.GenerateSeatsMatrix(1, 1);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var seat = ev.Seats.First();

        var owner = new User("Owner Bob", "owner@test.com", "hash", "Customer");
        var recipient = new User("Recipient Alice", "alice@test.com", "hash", "Customer");
        _context.Users.AddRange(owner, recipient);
        await _context.SaveChangesAsync();

        var ticket = new Ticket(ev.Id, seat.Id, owner.Id, 500000m);
        if (status == TicketStatus.Paid)
        {
            ticket.MarkAsPaid("OLD-OWNER-QR-TOKEN");
        }
        else if (status == TicketStatus.Used)
        {
            ticket.MarkAsPaid("OLD-OWNER-QR-TOKEN");
            ticket.CheckIn();
        }
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        return (ev, seat, owner, recipient, ticket);
    }

    [Fact]
    public async Task Handle_WhenTicketNotFound_ReturnsNotFound()
    {
        var handler = new TransferTicketCommandHandler(_context, _securityService.Object);
        var result = await handler.Handle(
            new TransferTicketCommand(Guid.NewGuid(), Guid.NewGuid(), "alice@test.com"),
            CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Code.Should().Be("TICKET_NOT_FOUND");
    }

    [Fact]
    public async Task Handle_WhenUserNotOwner_ReturnsForbidden()
    {
        var (_, _, _, _, ticket) = await SeedTransferScenarioAsync();
        var imposterId = Guid.NewGuid();

        var handler = new TransferTicketCommandHandler(_context, _securityService.Object);
        var result = await handler.Handle(
            new TransferTicketCommand(ticket.Id, imposterId, "alice@test.com"),
            CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Code.Should().Be("FORBIDDEN");
    }

    [Fact]
    public async Task Handle_WhenTicketNotPaid_ReturnsInvalidStatus()
    {
        var (_, _, owner, _, ticket) = await SeedTransferScenarioAsync(status: TicketStatus.Pending);

        var handler = new TransferTicketCommandHandler(_context, _securityService.Object);
        var result = await handler.Handle(
            new TransferTicketCommand(ticket.Id, owner.Id, "alice@test.com"),
            CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Code.Should().Be("INVALID_TICKET_STATUS");
    }

    [Fact]
    public async Task Handle_WhenEventAlreadyStarted_ReturnsError()
    {
        var (_, _, owner, _, ticket) = await SeedTransferScenarioAsync(eventDate: DateTime.UtcNow.AddMinutes(-10));

        var handler = new TransferTicketCommandHandler(_context, _securityService.Object);
        var result = await handler.Handle(
            new TransferTicketCommand(ticket.Id, owner.Id, "alice@test.com"),
            CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Code.Should().Be("EVENT_ALREADY_STARTED");
    }

    [Fact]
    public async Task Handle_WhenRecipientNotFound_ReturnsRecipientNotFound()
    {
        var (_, _, owner, _, ticket) = await SeedTransferScenarioAsync();

        var handler = new TransferTicketCommandHandler(_context, _securityService.Object);
        var result = await handler.Handle(
            new TransferTicketCommand(ticket.Id, owner.Id, "nonexistent@test.com"),
            CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Code.Should().Be("RECIPIENT_NOT_FOUND");
    }

    [Fact]
    public async Task Handle_WhenSelfTransfer_ReturnsSelfTransferNotAllowed()
    {
        var (_, _, owner, _, ticket) = await SeedTransferScenarioAsync();

        var handler = new TransferTicketCommandHandler(_context, _securityService.Object);
        var result = await handler.Handle(
            new TransferTicketCommand(ticket.Id, owner.Id, owner.Email),
            CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Code.Should().Be("SELF_TRANSFER_NOT_ALLOWED");
    }

    [Fact]
    public async Task Handle_WhenValid_TransfersOwnershipAndGeneratesNewQr()
    {
        var (_, _, owner, recipient, ticket) = await SeedTransferScenarioAsync();

        var handler = new TransferTicketCommandHandler(
            _context, 
            _securityService.Object, 
            emailService: _emailService.Object);

        var result = await handler.Handle(
            new TransferTicketCommand(ticket.Id, owner.Id, recipient.Email, "Tặng bạn vé này!"),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().ContainEquivalentOf("thành công");
        result.TransferId.Should().NotBeNull();

        // Verify ticket updated in DB
        var updatedTicket = await _context.Tickets.FindAsync(ticket.Id);
        updatedTicket!.UserId.Should().Be(recipient.Id);
        updatedTicket.QrCodeSignature.Should().Be("NEW-SIGNED-QR-TOKEN-FOR-RECIPIENT");

        // Verify audit record exists
        var transfer = await _context.TicketTransfers.FirstOrDefaultAsync(t => t.TicketId == ticket.Id);
        transfer.Should().NotBeNull();
        transfer!.SenderUserId.Should().Be(owner.Id);
        transfer.RecipientUserId.Should().Be(recipient.Id);
        transfer.RecipientEmail.Should().Be(recipient.Email.ToLowerInvariant());
        transfer.Status.Should().Be(TransferStatus.Completed);
        transfer.Note.Should().Be("Tặng bạn vé này!");

        // Verify new QR token was generated
        _securityService.Verify(s => s.GenerateSignedQrToken(
            ticket.Id,
            ticket.EventId,
            ticket.OrderCode,
            It.IsAny<DateTime>(),
            It.IsAny<string>()), Times.Once);
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }
}
