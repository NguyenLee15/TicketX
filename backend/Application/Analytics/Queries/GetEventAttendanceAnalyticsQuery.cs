using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;

namespace TickeX.Application.Analytics.Queries;

public record HeatmapBucketDto(
    string TimeLabel,
    DateTime StartTimeUtc,
    DateTime EndTimeUtc,
    int ScanCount,
    double PercentageOfCheckedIn
);

public record EventAttendanceAnalyticsDto(
    Guid EventId,
    string EventTitle,
    DateTime EventDate,
    int TotalCapacity,
    int TotalTicketsSold,
    int TotalCheckedIn,
    double ShowUpRate,
    string PeakInterval,
    int PeakScanCount,
    IReadOnlyList<HeatmapBucketDto> HeatmapBuckets
);

public record GetEventAttendanceAnalyticsQuery(Guid EventId) : IRequest<EventAttendanceAnalyticsDto>;

public class GetEventAttendanceAnalyticsQueryHandler : IRequestHandler<GetEventAttendanceAnalyticsQuery, EventAttendanceAnalyticsDto>
{
    private readonly IApplicationDbContext _context;

    public GetEventAttendanceAnalyticsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<EventAttendanceAnalyticsDto> Handle(GetEventAttendanceAnalyticsQuery request, CancellationToken cancellationToken)
    {
        var evt = await _context.Events
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == request.EventId, cancellationToken);

        if (evt == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy sự kiện với ID {request.EventId}.");
        }

        var tickets = await _context.Tickets
            .AsNoTracking()
            .Where(t => t.EventId == request.EventId &&
                        (t.Status == TicketStatus.Paid || t.Status == TicketStatus.Used))
            .Select(t => new { t.Id, t.Status, t.CheckedInAt })
            .ToListAsync(cancellationToken);

        int totalCapacity = await _context.Seats
            .AsNoTracking()
            .CountAsync(s => s.EventId == request.EventId, cancellationToken);

        int totalTicketsSold = tickets.Count;
        var checkedInTickets = tickets.Where(t => t.Status == TicketStatus.Used).ToList();
        int totalCheckedIn = checkedInTickets.Count;

        double showUpRate = totalTicketsSold > 0
            ? Math.Round((double)totalCheckedIn / totalTicketsSold * 100, 1)
            : 0;

        // Generate 15-minute heatmap intervals from 2 hours before event start to 2 hours after
        var windowStart = evt.Date.AddHours(-2);
        var windowEnd = evt.Date.AddHours(2);

        var buckets = new List<HeatmapBucketDto>();
        var current = windowStart;
        string peakInterval = "N/A";
        int peakScanCount = 0;

        while (current < windowEnd)
        {
            var next = current.AddMinutes(15);
            int count = checkedInTickets.Count(t => t.CheckedInAt.HasValue &&
                                                    t.CheckedInAt.Value >= current &&
                                                    t.CheckedInAt.Value < next);

            double pct = totalCheckedIn > 0 ? Math.Round((double)count / totalCheckedIn * 100, 1) : 0;
            string label = $"{current:HH:mm} - {next:HH:mm}";

            if (count > peakScanCount)
            {
                peakScanCount = count;
                peakInterval = label;
            }

            buckets.Add(new HeatmapBucketDto(
                TimeLabel: label,
                StartTimeUtc: current,
                EndTimeUtc: next,
                ScanCount: count,
                PercentageOfCheckedIn: pct
            ));

            current = next;
        }

        return new EventAttendanceAnalyticsDto(
            EventId: evt.Id,
            EventTitle: evt.Title,
            EventDate: evt.Date,
            TotalCapacity: totalCapacity,
            TotalTicketsSold: totalTicketsSold,
            TotalCheckedIn: totalCheckedIn,
            ShowUpRate: showUpRate,
            PeakInterval: peakInterval,
            PeakScanCount: peakScanCount,
            HeatmapBuckets: buckets
        );
    }
}

