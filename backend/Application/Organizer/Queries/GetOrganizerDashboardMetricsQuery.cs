namespace TickeX.Application.Organizer.Queries;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;

public record OrganizerMetricsDto(
    int TotalEvents,
    int TotalSeats,
    int TotalTicketsSold,
    int TotalCheckedInTickets,
    decimal TotalGrossRevenue,
    decimal TotalCommissionEstimated,
    decimal TotalNetRevenueEstimated,
    double AverageOccupancyRate,
    double LiveCheckInRate
);

public record GetOrganizerDashboardMetricsQuery(Guid OrganizerId) : IRequest<OrganizerMetricsDto>;

public class GetOrganizerDashboardMetricsQueryHandler : IRequestHandler<GetOrganizerDashboardMetricsQuery, OrganizerMetricsDto>
{
    private readonly IApplicationDbContext _context;

    public GetOrganizerDashboardMetricsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<OrganizerMetricsDto> Handle(GetOrganizerDashboardMetricsQuery request, CancellationToken cancellationToken)
    {
        var events = await _context.Events.AsNoTracking()
            .Where(e => e.OrganizerId == request.OrganizerId)
            .ToListAsync(cancellationToken);

        if (events.Count == 0)
        {
            return new OrganizerMetricsDto(0, 0, 0, 0, 0m, 0m, 0m, 0.0, 0.0);
        }

        var eventIds = events.Select(e => e.Id).ToList();
        var totalSeats = events.Sum(e => e.TotalSeats);

        var tickets = await _context.Tickets.AsNoTracking()
            .Where(t => eventIds.Contains(t.EventId) && (t.Status == TicketStatus.Paid || t.Status == TicketStatus.Used))
            .ToListAsync(cancellationToken);

        var totalSold = tickets.Count;
        var totalCheckedIn = tickets.Count(t => t.Status == TicketStatus.Used);
        var grossRevenue = tickets.Sum(t => t.Price);
        var commission = Math.Round(grossRevenue * 0.05m, 0);
        var netRevenue = grossRevenue - commission;
        var occupancyRate = totalSeats > 0 ? Math.Round((double)totalSold / totalSeats * 100, 1) : 0.0;
        var checkInRate = totalSold > 0 ? Math.Round((double)totalCheckedIn / totalSold * 100, 1) : 0.0;

        return new OrganizerMetricsDto(
            events.Count,
            totalSeats,
            totalSold,
            totalCheckedIn,
            grossRevenue,
            commission,
            netRevenue,
            occupancyRate,
            checkInRate
        );
    }
}

