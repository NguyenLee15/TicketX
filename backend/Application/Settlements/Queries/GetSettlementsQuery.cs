namespace TickeX.Application.Settlements.Queries;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;

public record SettlementDto(
    Guid Id,
    Guid EventId,
    string EventTitle,
    Guid OrganizerId,
    string OrganizerName,
    decimal GrossRevenue,
    decimal CommissionRate,
    decimal CommissionAmount,
    decimal RefundDeduction,
    decimal NetPayout,
    string BankName,
    string BankAccountNumber,
    string AccountHolder,
    SettlementStatus Status,
    string? AdminNote,
    DateTime RequestedAt,
    DateTime? ProcessedAt
);

public record GetSettlementsQuery(
    Guid? OrganizerId = null,
    SettlementStatus? Status = null
) : IRequest<List<SettlementDto>>;

public class GetSettlementsQueryHandler : IRequestHandler<GetSettlementsQuery, List<SettlementDto>>
{
    private readonly IApplicationDbContext _context;

    public GetSettlementsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<SettlementDto>> Handle(GetSettlementsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Settlements.AsNoTracking()
            .Include(s => s.Event)
            .Include(s => s.Organizer)
            .AsQueryable();

        if (request.OrganizerId.HasValue)
        {
            query = query.Where(s => s.OrganizerId == request.OrganizerId.Value);
        }

        if (request.Status.HasValue)
        {
            query = query.Where(s => s.Status == request.Status.Value);
        }

        var list = await query
            .OrderByDescending(s => s.RequestedAt)
            .ToListAsync(cancellationToken);

        return list.Select(s => new SettlementDto(
            s.Id,
            s.EventId,
            s.Event?.Title ?? "N/A",
            s.OrganizerId,
            s.Organizer?.Name ?? "N/A",
            s.GrossRevenue,
            s.CommissionRate,
            s.CommissionAmount,
            s.RefundDeduction,
            s.NetPayout,
            s.BankName,
            s.BankAccountNumber,
            s.AccountHolder,
            s.Status,
            s.AdminNote,
            s.RequestedAt,
            s.ProcessedAt
        )).ToList();
    }
}

