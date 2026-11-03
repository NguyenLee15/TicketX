namespace TickeX.Application.Coupons.Queries;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;

public record CouponDto(
    Guid Id,
    string Code,
    string Description,
    DiscountType DiscountType,
    decimal DiscountValue,
    decimal? MaxDiscountAmount,
    decimal MinOrderAmount,
    int UsageLimit,
    int UsedCount,
    DateTime ValidFrom,
    DateTime ValidTo,
    Guid? EventId,
    bool IsActive
);

public record GetActiveCouponsQuery(Guid? EventId = null) : IRequest<List<CouponDto>>;

public class GetActiveCouponsQueryHandler : IRequestHandler<GetActiveCouponsQuery, List<CouponDto>>
{
    private readonly IApplicationDbContext _context;

    public GetActiveCouponsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<CouponDto>> Handle(GetActiveCouponsQuery request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        var query = _context.Coupons.AsNoTracking()
            .Where(c => c.IsActive && c.ValidFrom <= now && c.ValidTo >= now && c.UsedCount < c.UsageLimit);

        if (request.EventId.HasValue)
        {
            query = query.Where(c => c.EventId == null || c.EventId == request.EventId.Value);
        }
        else
        {
            query = query.Where(c => c.EventId == null);
        }

        return await query
            .OrderBy(c => c.ValidTo)
            .Select(c => new CouponDto(
                c.Id,
                c.Code,
                c.Description,
                c.DiscountType,
                c.DiscountValue,
                c.MaxDiscountAmount,
                c.MinOrderAmount,
                c.UsageLimit,
                c.UsedCount,
                c.ValidFrom,
                c.ValidTo,
                c.EventId,
                c.IsActive
            ))
            .ToListAsync(cancellationToken);
    }
}

