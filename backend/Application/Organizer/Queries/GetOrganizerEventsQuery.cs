namespace TickeX.Application.Organizer.Queries;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;

public record OrganizerEventDto(
    Guid Id,
    string Title,
    DateTime Date,
    DateTime EndDate,
    string Location,
    string VenueName,
    string Category,
    int TotalSeats,
    int SoldTickets,
    int CheckedInTickets,
    decimal GrossRevenue,
    EventStatus Status
);

public record GetOrganizerEventsQuery(Guid OrganizerId) : IRequest<List<OrganizerEventDto>>;

public class GetOrganizerEventsQueryHandler : IRequestHandler<GetOrganizerEventsQuery, List<OrganizerEventDto>>
{
    private readonly IApplicationDbContext _context;

    public GetOrganizerEventsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<OrganizerEventDto>> Handle(GetOrganizerEventsQuery request, CancellationToken cancellationToken)
    {
        // Strict Data Isolation: Only events owned by this OrganizerId
        var events = await _context.Events.AsNoTracking()
            .Where(e => e.OrganizerId == request.OrganizerId)
            .OrderByDescending(e => e.Date)
            .ToListAsync(cancellationToken);

        var eventIds = events.Select(e => e.Id).ToList();

        // Calculate sold tickets, checked-in tickets and revenue per event
        var tickets = await _context.Tickets.AsNoTracking()
            .Where(t => eventIds.Contains(t.EventId) && (t.Status == TicketStatus.Paid || t.Status == TicketStatus.Used))
            .Select(t => new { t.EventId, t.Price, t.Status })
            .ToListAsync(cancellationToken);

        var ticketStats = tickets
            .GroupBy(t => t.EventId)
            .ToDictionary(
                g => g.Key,
                g => new
                {
                    SoldCount = g.Count(),
                    CheckedInCount = g.Count(t => t.Status == TicketStatus.Used),
                    Revenue = g.Sum(t => t.Price)
                }
            );

        return events.Select(e =>
        {
            var hasStats = ticketStats.TryGetValue(e.Id, out var stat);
            return new OrganizerEventDto(
                e.Id,
                e.Title,
                e.Date,
                e.EndDate,
                e.Location,
                e.VenueName,
                e.Category,
                e.TotalSeats,
                hasStats && stat != null ? stat.SoldCount : 0,
                hasStats && stat != null ? stat.CheckedInCount : 0,
                hasStats && stat != null ? stat.Revenue : 0m,
                e.Status
            );
        }).ToList();
    }
}
