using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Analytics.Queries;
using TickeX.Application.Invoices.Commands;
using TickeX.Application.Invoices.Queries;
using TickeX.Domain.Entities;
using TickeX.Infrastructure.Persistence;
using Xunit;

namespace TickeX.UnitTests.InvoicesAndAnalytics;

public sealed class InvoiceAndAnalyticsTests : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    private readonly ApplicationDbContext _context;

    public InvoiceAndAnalyticsTests()
    {
        _connection.Open();
        _context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options);
        _context.Database.EnsureCreated();
    }

    [Fact]
    public async Task CreateInvoiceRequest_CalculatesSubTotalAndGeneratesLookupCode()
    {
        var user = new User("Company Rep", "rep@fpt.com", "hash", "Customer");
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var ev = new Event(
            "Tech Summit 2026", "Desc", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(4),
            "TP.HCM", "SECC", 5, "Hội thảo", basePrice: 1_100_000m);
        ev.GenerateSeatsMatrix(1, 5);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var seat = ev.Seats.First();
        long orderCode = 20261103001;
        var ticket = new Ticket(ev.Id, seat.Id, user.Id, 1_100_000m, orderCode);
        ticket.MarkAsPaid("SIG");
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        var handler = new CreateInvoiceRequestCommandHandler(_context);
        var command = new CreateInvoiceRequestCommand(
            OrderCode: orderCode,
            UserId: user.Id,
            TaxCode: "0101234567",
            CompanyName: "TẬP ĐOÀN CÔNG NGHỆ FPT",
            CompanyAddress: "Số 10 Phạm Văn Bạch, Cầu Giấy, Hà Nội",
            RecipientEmail: "invoice@fpt.com",
            VatRate: 0.10m
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        result.OrderCode.Should().Be(orderCode);
        result.TaxCode.Should().Be("0101234567");
        result.TotalAmount.Should().Be(1_100_000m);
        result.VatRate.Should().Be(0.10m);
        result.SubTotal.Should().Be(1_000_000m); // 1,100,000 / 1.10 = 1,000,000
        result.VatAmount.Should().Be(100_000m);
        result.InvoiceLookupCode.Should().HaveLength(8);
        result.InvoiceNumber.Should().StartWith("HD");
        result.Status.Should().Be("Issued");

        // Lookup test
        var lookupHandler = new GetInvoiceQueriesHandler(_context);
        var lookupResult = await lookupHandler.Handle(new GetInvoiceLookupQuery(result.InvoiceLookupCode), CancellationToken.None);

        lookupResult.Should().NotBeNull();
        lookupResult!.CompanyName.Should().Be("TẬP ĐOÀN CÔNG NGHỆ FPT");
    }

    [Fact]
    public async Task GetEventAttendanceAnalytics_CalculatesShowUpRateAndHeatmap()
    {
        var user = new User("Attendee", "att@test.com", "hash", "Customer");
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var eventDate = new DateTime(2026, 12, 1, 19, 0, 0, DateTimeKind.Utc);
        var ev = new Event(
            "Gala Âm Nhạc", "Desc", eventDate, eventDate.AddHours(3),
            "Hà Nội", "Nhà Hát Lớn", 4, "Âm nhạc", basePrice: 500000m);
        ev.GenerateSeatsMatrix(1, 4);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var seats = ev.Seats.ToList();

        // 3 tickets sold: 2 checked in, 1 no-show
        var t1 = new Ticket(ev.Id, seats[0].Id, user.Id, 500000m);
        t1.MarkAsPaid("S1");
        t1.CheckIn(); // Used

        var t2 = new Ticket(ev.Id, seats[1].Id, user.Id, 500000m);
        t2.MarkAsPaid("S2");
        t2.CheckIn(); // Used

        var t3 = new Ticket(ev.Id, seats[2].Id, user.Id, 500000m);
        t3.MarkAsPaid("S3"); // Paid but no-show

        _context.Tickets.AddRange(t1, t2, t3);
        await _context.SaveChangesAsync();

        var handler = new GetEventAttendanceAnalyticsQueryHandler(_context);
        var analytics = await handler.Handle(new GetEventAttendanceAnalyticsQuery(ev.Id), CancellationToken.None);

        analytics.Should().NotBeNull();
        analytics.TotalCapacity.Should().Be(4);
        analytics.TotalTicketsSold.Should().Be(3);
        analytics.TotalCheckedIn.Should().Be(2);
        // Show-up rate = 2 / 3 * 100 = 66.7%
        analytics.ShowUpRate.Should().Be(66.7);
        analytics.HeatmapBuckets.Should().NotBeEmpty();
    }

    public void Dispose()
    {
        _connection.Dispose();
        _context.Dispose();
    }
}
