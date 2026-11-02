using Microsoft.EntityFrameworkCore;
using TickeX.Application.Admin.Queries;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;

namespace TickeX.Infrastructure.Services;

/// <summary>
/// EF projection Adapter for the dashboard read Seam. Application does not
/// depend on DbSet details; this implementation owns query shape and filtering.
/// </summary>
public sealed class DashboardReadModelAdapter : IDashboardReadModel
{
    private readonly IApplicationDbContext _context;
    private readonly ITimePolicy _time;

    public DashboardReadModelAdapter(IApplicationDbContext context, ITimePolicy time)
    {
        _context = context;
        _time = time;
    }

    public async Task<DashboardStatsResult> GetAsync(CancellationToken cancellationToken)
    {
        var operationalTickets = _context.Tickets
            .AsNoTracking()
            .Where(t => t.Event != null && !t.Event.IsDeleted);
        var totalUsers = await _context.Users.CountAsync(cancellationToken);
        var totalEvents = await _context.Events.CountAsync(e => !e.IsDeleted, cancellationToken);
        var paidStates = new[] { TicketStatus.Paid, TicketStatus.Used };

        var isSqlite = (_context as DbContext)?.Database.ProviderName?.Contains("Sqlite", StringComparison.OrdinalIgnoreCase) == true;

        int totalTicketsSold;
        decimal totalRevenue;
        decimal totalRefunded;
        decimal totalRefundPending;
        int totalCheckedIn;

        if (isSqlite)
        {
            var kpi = await operationalTickets
                .GroupBy(_ => 1)
                .Select(g => new
                {
                    Sold = g.Count(t => paidStates.Contains(t.Status)),
                    Rev = g.Where(t => t.PaidAt.HasValue && (paidStates.Contains(t.Status) || t.Status == TicketStatus.RefundPending || t.Status == TicketStatus.Cancelled))
                           .Sum(t => (double?)t.Price) ?? 0,
                    Refunded = g.Where(t => t.Status == TicketStatus.Cancelled && t.RefundAmount.HasValue)
                                .Sum(t => (double?)t.RefundAmount) ?? 0,
                    Pending = g.Where(t => t.Status == TicketStatus.RefundPending)
                               .Sum(t => (double?)t.Price) ?? 0,
                    CheckedIn = g.Count(t => t.Status == TicketStatus.Used)
                })
                .FirstOrDefaultAsync(cancellationToken);

            totalTicketsSold = kpi?.Sold ?? 0;
            totalRevenue = kpi != null ? Math.Round((decimal)kpi.Rev, 2, MidpointRounding.AwayFromZero) : 0m;
            totalRefunded = kpi != null ? Math.Round((decimal)kpi.Refunded, 2, MidpointRounding.AwayFromZero) : 0m;
            totalRefundPending = kpi != null ? Math.Round((decimal)kpi.Pending, 2, MidpointRounding.AwayFromZero) : 0m;
            totalCheckedIn = kpi?.CheckedIn ?? 0;
        }
        else
        {
            var kpi = await operationalTickets
                .GroupBy(_ => 1)
                .Select(g => new
                {
                    Sold = g.Count(t => paidStates.Contains(t.Status)),
                    Rev = g.Where(t => t.PaidAt.HasValue && (paidStates.Contains(t.Status) || t.Status == TicketStatus.RefundPending || t.Status == TicketStatus.Cancelled))
                           .Sum(t => (decimal?)t.Price) ?? 0m,
                    Refunded = g.Where(t => t.Status == TicketStatus.Cancelled && t.RefundAmount.HasValue)
                                .Sum(t => t.RefundAmount) ?? 0m,
                    Pending = g.Where(t => t.Status == TicketStatus.RefundPending)
                               .Sum(t => (decimal?)t.Price) ?? 0m,
                    CheckedIn = g.Count(t => t.Status == TicketStatus.Used)
                })
                .FirstOrDefaultAsync(cancellationToken);

            totalTicketsSold = kpi?.Sold ?? 0;
            totalRevenue = kpi?.Rev ?? 0m;
            totalRefunded = kpi?.Refunded ?? 0m;
            totalRefundPending = kpi?.Pending ?? 0m;
            totalCheckedIn = kpi?.CheckedIn ?? 0;
        }
        List<TopEventAggregate> topAggregates;
        if (isSqlite)
        {
            var sqliteAggregates = await operationalTickets
                .Where(t => paidStates.Contains(t.Status))
                .GroupBy(t => t.EventId)
                .Select(g => new { g.Key, TicketsSold = g.Count(), Revenue = g.Sum(t => (double)t.Price) })
                .OrderByDescending(x => x.Revenue)
                .ThenBy(x => x.Key)
                .Take(5)
                .ToListAsync(cancellationToken);
            topAggregates = sqliteAggregates
                .Select(x => new TopEventAggregate(x.Key, x.TicketsSold, (decimal)x.Revenue))
                .ToList();
        }
        else
        {
            topAggregates = await operationalTickets
                .Where(t => paidStates.Contains(t.Status))
                .GroupBy(t => t.EventId)
                .Select(g => new TopEventAggregate(g.Key, g.Count(), g.Sum(t => t.Price)))
                .OrderByDescending(x => x.Revenue)
                .ThenBy(x => x.EventId)
                .Take(5)
                .ToListAsync(cancellationToken);
        }
        var eventIds = topAggregates.Select(x => x.EventId).ToList();
        var eventDetails = await _context.Events.AsNoTracking().Where(e => eventIds.Contains(e.Id))
            .Select(e => new { e.Id, e.Title, e.Category, e.TotalSeats }).ToListAsync(cancellationToken);
        var topEvents = topAggregates.Select(x =>
        {
            var ev = eventDetails.FirstOrDefault(e => e.Id == x.EventId);
            return new TopEventStat(x.EventId, ev?.Title ?? "N/A", ev?.Category ?? "N/A", x.TicketsSold, x.Revenue, ev?.TotalSeats ?? 0);
        }).ToList();

        var localToday = _time.LocalNow.Date;
        var cutoffLocal = localToday.AddDays(-6);
        var cutoffUtc = _time.ToUtc(cutoffLocal);
        Dictionary<DateTime, (decimal Revenue, int Count)> grouped;
        if (isSqlite)
        {
            var recentPaid = await operationalTickets
                .Where(t => paidStates.Contains(t.Status) && t.PaidAt.HasValue && t.PaidAt.Value >= cutoffUtc)
                .Select(t => new { t.PaidAt, t.Price }).ToListAsync(cancellationToken);
            grouped = recentPaid
                .GroupBy(x => _time.ToLocal(x.PaidAt!.Value).Date)
                .ToDictionary(g => g.Key, g => (g.Sum(x => x.Price), g.Count()));
        }
        else
        {
            var sqlServerGroups = await operationalTickets
                .Where(t => paidStates.Contains(t.Status) && t.PaidAt.HasValue && t.PaidAt.Value >= cutoffUtc)
                .GroupBy(t => EF.Functions.DateDiffDay(cutoffUtc, t.PaidAt!.Value))
                .Select(g => new { Offset = g.Key, Revenue = g.Sum(t => t.Price), Count = g.Count() })
                .ToListAsync(cancellationToken);
            grouped = sqlServerGroups.ToDictionary(
                x => cutoffLocal.AddDays(x.Offset),
                x => (x.Revenue, x.Count));
        }
        var dailyStats = Enumerable.Range(0, 7).Select(i =>
        {
            var date = cutoffLocal.AddDays(i);
            return grouped.TryGetValue(date, out var value)
                ? new DailyRevenueStat(date.ToString("yyyy-MM-dd"), value.Revenue, value.Count)
                : new DailyRevenueStat(date.ToString("yyyy-MM-dd"), 0m, 0);
        }).ToList();

        var recentTransactions = await operationalTickets
            .Where(t => paidStates.Contains(t.Status) || t.Status == TicketStatus.RefundPending || (t.Status == TicketStatus.Cancelled && (t.PaidAt.HasValue || t.RefundAmount.HasValue || t.RefundedAt.HasValue)))
            .OrderByDescending(t => t.CreatedAt)
            .ThenByDescending(t => t.Id)
            .Take(10)
            .Select(t => new RecentTransactionStat(t.Id, t.OrderCode, t.Event!.Title, t.User != null ? t.User.Name : "N/A", t.Price, t.Status.ToString(), t.CreatedAt))
            .ToListAsync(cancellationToken);

        return new DashboardStatsResult(totalUsers, totalEvents, totalTicketsSold, totalRevenue, totalRefunded,
            totalCheckedIn, topEvents, recentTransactions, dailyStats, totalRefundPending,
            totalRevenue - totalRefunded - totalRefundPending);
    }

    private sealed record TopEventAggregate(Guid EventId, int TicketsSold, decimal Revenue);
}
