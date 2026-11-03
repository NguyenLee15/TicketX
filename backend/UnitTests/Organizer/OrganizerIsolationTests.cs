using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Organizer.Commands;
using TickeX.Application.Organizer.Queries;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using TickeX.Infrastructure.Persistence;
using Xunit;

namespace TickeX.UnitTests.Organizer;

public sealed class OrganizerIsolationTests : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    private readonly ApplicationDbContext _context;

    public OrganizerIsolationTests()
    {
        _connection.Open();
        _context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options);
        _context.Database.EnsureCreated();
    }

    [Fact]
    public async Task GetOrganizerEvents_StrictlyIsolatesEventsPerOrganizer()
    {
        var organizerA = new User("Organizer A", "orgA@test.com", "hash", "Organizer");
        var organizerB = new User("Organizer B", "orgB@test.com", "hash", "Organizer");
        _context.Users.AddRange(organizerA, organizerB);
        await _context.SaveChangesAsync();

        var eventA1 = new Event(
            "Event A1", "Desc", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(3),
            "Hanoi", "Venue A", 50, "Concert", organizerId: organizerA.Id);

        var eventA2 = new Event(
            "Event A2", "Desc", DateTime.UtcNow.AddDays(10), DateTime.UtcNow.AddDays(10).AddHours(3),
            "Hanoi", "Venue A", 100, "Concert", organizerId: organizerA.Id);

        var eventB = new Event(
            "Event B", "Desc", DateTime.UtcNow.AddDays(7), DateTime.UtcNow.AddDays(7).AddHours(3),
            "HCMC", "Venue B", 200, "Concert", organizerId: organizerB.Id);

        _context.Events.AddRange(eventA1, eventA2, eventB);
        await _context.SaveChangesAsync();

        var handler = new GetOrganizerEventsQueryHandler(_context);

        // When Organizer A queries:
        var resultA = await handler.Handle(new GetOrganizerEventsQuery(organizerA.Id), CancellationToken.None);

        resultA.Should().HaveCount(2);
        resultA.Select(e => e.Id).Should().Contain(new[] { eventA1.Id, eventA2.Id });
        resultA.Select(e => e.Id).Should().NotContain(eventB.Id);

        // When Organizer B queries:
        var resultB = await handler.Handle(new GetOrganizerEventsQuery(organizerB.Id), CancellationToken.None);

        resultB.Should().HaveCount(1);
        resultB.Single().Id.Should().Be(eventB.Id);
    }

    [Fact]
    public async Task GetOrganizerDashboardMetrics_AccuratelyAggregatesOnlyOwnedEventRevenue()
    {
        var organizer = new User("Organizer Metrics", "metrics@test.com", "hash", "Organizer");
        var customer = new User("Customer", "customer@test.com", "hash", "Customer");
        _context.Users.AddRange(organizer, customer);
        await _context.SaveChangesAsync();

        var ev = new Event(
            "Festival 2026", "Desc", DateTime.UtcNow.AddDays(10), DateTime.UtcNow.AddDays(10).AddHours(4),
            "Da Nang", "Beach", 10, "Music", basePrice: 500_000m, organizerId: organizer.Id);
        ev.GenerateSeatsMatrix(2, 5); // 10 seats
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var seat1 = ev.Seats.First();
        var seat2 = ev.Seats.Skip(1).First();

        var ticket1 = new Ticket(ev.Id, seat1.Id, customer.Id, 500_000m);
        ticket1.MarkAsPaid("SIG1");
        var ticket2 = new Ticket(ev.Id, seat2.Id, customer.Id, 500_000m);
        ticket2.MarkAsPaid("SIG2");

        _context.Tickets.AddRange(ticket1, ticket2);
        await _context.SaveChangesAsync();

        var handler = new GetOrganizerDashboardMetricsQueryHandler(_context);
        var metrics = await handler.Handle(new GetOrganizerDashboardMetricsQuery(organizer.Id), CancellationToken.None);

        metrics.TotalEvents.Should().Be(1);
        metrics.TotalSeats.Should().Be(10);
        metrics.TotalTicketsSold.Should().Be(2);
        metrics.TotalGrossRevenue.Should().Be(1_000_000m);
        metrics.TotalCommissionEstimated.Should().Be(50_000m); // 5%
        metrics.TotalNetRevenueEstimated.Should().Be(950_000m); // 95%
        metrics.AverageOccupancyRate.Should().Be(20.0); // 2/10 = 20%
        metrics.TotalCheckedInTickets.Should().Be(0);
        metrics.LiveCheckInRate.Should().Be(0.0);
    }

    [Fact]
    public async Task GetOrganizerEventTickets_StrictlyIsolatesTicketsPerOrganizer()
    {
        var organizerA = new User("Organizer A", "orgA_tickets@test.com", "hash", "Organizer");
        var organizerB = new User("Organizer B", "orgB_tickets@test.com", "hash", "Organizer");
        var customer = new User("Customer", "cust_tickets@test.com", "hash", "Customer");
        _context.Users.AddRange(organizerA, organizerB, customer);
        await _context.SaveChangesAsync();

        var evA = new Event("Concert A", "Desc", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(3),
            "Hanoi", "National Stadium", 10, "Music", organizerId: organizerA.Id);
        evA.GenerateSeatsMatrix(2, 5);
        _context.Events.Add(evA);
        await _context.SaveChangesAsync();

        var seat = evA.Seats.First();
        var ticket = new Ticket(evA.Id, seat.Id, customer.Id, 250_000m);
        ticket.MarkAsPaid("SIG_A");
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        var handler = new GetOrganizerEventTicketsQueryHandler(_context);

        // Organizer A queries own event -> Success
        var queryA = new GetOrganizerEventTicketsQuery(evA.Id, organizerA.Id);
        var resultA = await handler.Handle(queryA, CancellationToken.None);
        resultA.Success.Should().BeTrue();
        resultA.Tickets.Should().HaveCount(1);
        resultA.Tickets.First().CustomerName.Should().Be("Customer");
        resultA.Tickets.First().Price.Should().Be(250_000m);

        // Organizer B queries Organizer A's event -> Forbidden
        var queryB = new GetOrganizerEventTicketsQuery(evA.Id, organizerB.Id);
        var resultB = await handler.Handle(queryB, CancellationToken.None);
        resultB.Success.Should().BeFalse();
        resultB.ErrorCode.Should().Be("ORGANIZER_FORBIDDEN");
        resultB.Tickets.Should().BeEmpty();

        // Admin queries Organizer A's event with IsAdmin=true -> Allowed
        var queryAdmin = new GetOrganizerEventTicketsQuery(evA.Id, Guid.NewGuid(), IsAdmin: true);
        var resultAdmin = await handler.Handle(queryAdmin, CancellationToken.None);
        resultAdmin.Success.Should().BeTrue();
        resultAdmin.Tickets.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetOrganizerEvents_AccuratelyCalculatesCheckedInTickets()
    {
        var organizer = new User("Organizer Live", "live@test.com", "hash", "Organizer");
        var customer1 = new User("Cust 1", "cust1@test.com", "hash", "Customer");
        var customer2 = new User("Cust 2", "cust2@test.com", "hash", "Customer");
        _context.Users.AddRange(organizer, customer1, customer2);
        await _context.SaveChangesAsync();

        var ev = new Event("Live Concert", "Desc", DateTime.UtcNow.AddDays(1), DateTime.UtcNow.AddDays(1).AddHours(3),
            "HCMC", "Gymnasium", 10, "Music", organizerId: organizer.Id);
        ev.GenerateSeatsMatrix(2, 5);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var seat1 = ev.Seats.First();
        var seat2 = ev.Seats.Skip(1).First();

        var ticket1 = new Ticket(ev.Id, seat1.Id, customer1.Id, 300_000m);
        ticket1.MarkAsPaid("SIG1");
        ticket1.CheckIn(); // Checked in!

        var ticket2 = new Ticket(ev.Id, seat2.Id, customer2.Id, 300_000m);
        ticket2.MarkAsPaid("SIG2"); // Paid only

        _context.Tickets.AddRange(ticket1, ticket2);
        await _context.SaveChangesAsync();

        // Check events query
        var eventsHandler = new GetOrganizerEventsQueryHandler(_context);
        var eventsResult = await eventsHandler.Handle(new GetOrganizerEventsQuery(organizer.Id), CancellationToken.None);
        eventsResult.Should().HaveCount(1);
        var evtDto = eventsResult.Single();
        evtDto.SoldTickets.Should().Be(2);
        evtDto.CheckedInTickets.Should().Be(1);

        // Check dashboard metrics query
        var metricsHandler = new GetOrganizerDashboardMetricsQueryHandler(_context);
        var metrics = await metricsHandler.Handle(new GetOrganizerDashboardMetricsQuery(organizer.Id), CancellationToken.None);
        metrics.TotalTicketsSold.Should().Be(2);
        metrics.TotalCheckedInTickets.Should().Be(1);
        metrics.LiveCheckInRate.Should().Be(50.0); // 1/2 = 50%
    }

    [Fact]
    public async Task CreateOrganizerEvent_BindsToCallerAndGeneratesSeats()
    {
        var organizer = new User("New Org", "neworg@test.com", "hash", "Organizer");
        _context.Users.Add(organizer);
        await _context.SaveChangesAsync();

        var command = new CreateOrganizerEventCommand(
            organizer.Id,
            "Indie Rock Night",
            "Awesome indie bands",
            DateTime.UtcNow.AddDays(15),
            DateTime.UtcNow.AddDays(15).AddHours(3),
            "Ha Noi",
            "Hanoi Rock City",
            "Concert",
            "https://img.local/post.jpg",
            "https://img.local/banner.jpg",
            300_000m,
            RefundCutoffHours: 24,
            Rows: 5,
            Cols: 10
        );

        var handler = new CreateOrganizerEventCommandHandler(_context);
        var result = await handler.Handle(command, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.EventId.Should().NotBeNull();

        var createdEvent = await _context.Events.Include(e => e.Seats).FirstOrDefaultAsync(e => e.Id == result.EventId);
        createdEvent.Should().NotBeNull();
        createdEvent!.OrganizerId.Should().Be(organizer.Id);
        createdEvent.OrganizerName.Should().Be(organizer.Name);
        createdEvent.Seats.Should().HaveCount(50); // 5 rows * 10 cols
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }
}

