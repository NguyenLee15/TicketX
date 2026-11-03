namespace TickeX.Application.Organizer.Queries;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;

public record OrganizerTicketReportItemDto(
    Guid Id,
    long OrderCode,
    string CustomerName,
    string CustomerEmail,
    string SeatRow,
    int SeatNumber,
    int SeatTier,
    decimal Price,
    TicketStatus Status,
    DateTime? PaidAt,
    DateTime? CheckedInAt
);

public record GetOrganizerEventTicketsQueryResult(
    bool Success,
    string? ErrorCode,
    string? Message,
    List<OrganizerTicketReportItemDto> Tickets
);

public record GetOrganizerEventTicketsQuery(
    Guid EventId,
    Guid OrganizerId,
    bool IsAdmin = false
) : IRequest<GetOrganizerEventTicketsQueryResult>;

public class GetOrganizerEventTicketsQueryHandler : IRequestHandler<GetOrganizerEventTicketsQuery, GetOrganizerEventTicketsQueryResult>
{
    private readonly IApplicationDbContext _context;

    public GetOrganizerEventTicketsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<GetOrganizerEventTicketsQueryResult> Handle(GetOrganizerEventTicketsQuery request, CancellationToken cancellationToken)
    {
        var ev = await _context.Events.AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == request.EventId, cancellationToken);

        if (ev == null)
        {
            return new GetOrganizerEventTicketsQueryResult(
                false,
                "EVENT_NOT_FOUND",
                "Không tìm thấy sự kiện được yêu cầu.",
                new List<OrganizerTicketReportItemDto>()
            );
        }

        // Strict Data Isolation: Only event owner or system admin can export tickets
        if (!request.IsAdmin && ev.OrganizerId != request.OrganizerId)
        {
            return new GetOrganizerEventTicketsQueryResult(
                false,
                "ORGANIZER_FORBIDDEN",
                "Bạn không có quyền truy cập danh sách vé của sự kiện này.",
                new List<OrganizerTicketReportItemDto>()
            );
        }

        var tickets = await _context.Tickets.AsNoTracking()
            .Include(t => t.Seat)
            .Include(t => t.User)
            .Where(t => t.EventId == request.EventId && (t.Status == TicketStatus.Paid || t.Status == TicketStatus.Used))
            .OrderBy(t => t.Seat.Row)
            .ThenBy(t => t.Seat.Number)
            .ToListAsync(cancellationToken);

        var dtoList = tickets.Select(t => new OrganizerTicketReportItemDto(
            t.Id,
            t.OrderCode,
            t.User?.Name ?? "Khách hàng",
            t.User?.Email ?? string.Empty,
            t.Seat?.Row ?? string.Empty,
            t.Seat?.Number ?? 0,
            (int)(t.Seat?.Tier ?? SeatTier.Standard),
            t.Price,
            t.Status,
            t.PaidAt,
            t.CheckedInAt
        )).ToList();

        return new GetOrganizerEventTicketsQueryResult(true, null, null, dtoList);
    }
}
