using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Tickets.Commands;
using TickeX.Application.Tickets.Queries;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using TickeX.Infrastructure.Persistence;
using Xunit;

namespace TickeX.UnitTests.OfflineCheckIn;

public sealed class OfflineSyncTests : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    private readonly ApplicationDbContext _context;

    public OfflineSyncTests()
    {
        _connection.Open();
        _context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options);
        _context.Database.EnsureCreated();
    }

    private async Task<(Event ev, Ticket t1, Ticket t2)> SeedEventAndTicketsAsync()
    {
        var organizer = new User("Org", "org@offline.com", "hash", "Organizer");
        var customer = new User("Attendee", "att@offline.com", "hash", "Customer");
        _context.Users.AddRange(organizer, customer);
        await _context.SaveChangesAsync();

        var ev = new Event(
            "Concert Sân Vận Động", "Mô tả", DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(2).AddHours(3),
            "Hà Nội", "Mỹ Đình", 10, "Âm nhạc", basePrice: 500000, organizerId: organizer.Id);
        ev.GenerateSeatsMatrix(1, 10);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var seats = ev.Seats.OrderBy(s => s.Row).ThenBy(s => s.Number).ToList();

        var t1 = new Ticket(ev.Id, seats[0].Id, customer.Id, 500000);
        t1.MarkAsPaid("SIG_HASH_001_SECRET");

        var t2 = new Ticket(ev.Id, seats[1].Id, customer.Id, 500000);
        t2.MarkAsPaid("SIG_HASH_002_SECRET");

        _context.Tickets.AddRange(t1, t2);
        await _context.SaveChangesAsync();

        return (ev, t1, t2);
    }

    [Fact]
    public async Task GetEventOfflineManifest_ReturnsValidTicketsWithSignatures()
    {
        var (ev, t1, t2) = await SeedEventAndTicketsAsync();
        var handler = new GetEventOfflineManifestQueryHandler(_context);

        var manifest = await handler.Handle(new GetEventOfflineManifestQuery(ev.Id), CancellationToken.None);

        manifest.Should().NotBeNull();
        manifest.EventId.Should().Be(ev.Id);
        manifest.TotalTickets.Should().Be(2);
        manifest.Tickets.Should().HaveCount(2);

        var firstTicket = manifest.Tickets.First(t => t.TicketId == t1.Id);
        firstTicket.QrSignatureHash.Should().Be("SIG_HASH_001_SECRET");
        firstTicket.IsAlreadyUsed.Should().BeFalse();
        firstTicket.AttendeeName.Should().Be("Attendee");
    }

    [Fact]
    public async Task SyncOfflineCheckIns_ValidScans_MarksTicketsAsUsed()
    {
        var (ev, t1, t2) = await SeedEventAndTicketsAsync();
        var handler = new SyncOfflineCheckInsCommandHandler(_context);

        var scans = new List<OfflineCheckInRecord>
        {
            new(t1.Id, DateTime.UtcNow.AddMinutes(-10), "Gate A", "staff-1", "device-x"),
            new(t2.Id, DateTime.UtcNow.AddMinutes(-8), "Gate B", "staff-2", "device-y")
        };

        var result = await handler.Handle(new SyncOfflineCheckInsCommand(ev.Id, scans), CancellationToken.None);

        result.TotalProcessed.Should().Be(2);
        result.Successful.Should().Be(2);
        result.DuplicatesRejected.Should().Be(0);
        result.Conflicts.Should().BeEmpty();

        var reloadedT1 = await _context.Tickets.FindAsync(t1.Id);
        var reloadedT2 = await _context.Tickets.FindAsync(t2.Id);

        reloadedT1!.Status.Should().Be(TicketStatus.Used);
        reloadedT2!.Status.Should().Be(TicketStatus.Used);
    }

    [Fact]
    public async Task SyncOfflineCheckIns_DuplicateScanOnUsedTicket_RejectsWithConflict()
    {
        var (ev, t1, _) = await SeedEventAndTicketsAsync();
        t1.CheckIn(); // Already checked in on server
        await _context.SaveChangesAsync();

        var handler = new SyncOfflineCheckInsCommandHandler(_context);

        var scans = new List<OfflineCheckInRecord>
        {
            new(t1.Id, DateTime.UtcNow, "Gate C", "staff-3", "device-z")
        };

        var result = await handler.Handle(new SyncOfflineCheckInsCommand(ev.Id, scans), CancellationToken.None);

        result.TotalProcessed.Should().Be(1);
        result.Successful.Should().Be(0);
        result.DuplicatesRejected.Should().Be(1);
        result.Conflicts.Should().HaveCount(1);

        var conflict = result.Conflicts.First();
        conflict.ConflictCode.Should().Be("DUPLICATE_SCAN_REJECTED");
        conflict.Gate.Should().Be("Gate C");
    }

    public void Dispose()
    {
        _connection.Dispose();
        _context.Dispose();
    }
}

