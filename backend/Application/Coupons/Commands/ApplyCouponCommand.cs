namespace TickeX.Application.Coupons.Commands;

using MediatR;

public record ApplyCouponCommand(
    string Code,
    decimal OrderAmount,
    Guid? EventId = null
) : IRequest<ApplyCouponResult>;

public record ApplyCouponResult(
    bool Success,
    string Code,
    decimal DiscountAmount,
    decimal FinalAmount,
    string? Message = null,
    string? ErrorCode = null
);

