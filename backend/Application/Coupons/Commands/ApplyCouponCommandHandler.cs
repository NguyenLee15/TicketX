namespace TickeX.Application.Coupons.Commands;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;

public class ApplyCouponCommandHandler : IRequestHandler<ApplyCouponCommand, ApplyCouponResult>
{
    private readonly IApplicationDbContext _context;

    public ApplyCouponCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ApplyCouponResult> Handle(ApplyCouponCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
        {
            return new ApplyCouponResult(
                Success: false,
                Code: string.Empty,
                DiscountAmount: 0,
                FinalAmount: request.OrderAmount,
                Message: "Mã giảm giá không được để trống.",
                ErrorCode: "INVALID_COUPON_CODE"
            );
        }

        var normalizedCode = request.Code.Trim().ToUpperInvariant();
        var coupon = await _context.Coupons.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Code == normalizedCode, cancellationToken);

        if (coupon == null)
        {
            return new ApplyCouponResult(
                Success: false,
                Code: normalizedCode,
                DiscountAmount: 0,
                FinalAmount: request.OrderAmount,
                Message: "Mã giảm giá không tồn tại trên hệ thống.",
                ErrorCode: "COUPON_NOT_FOUND"
            );
        }

        if (coupon.EventId.HasValue && request.EventId.HasValue && coupon.EventId.Value != request.EventId.Value)
        {
            return new ApplyCouponResult(
                Success: false,
                Code: normalizedCode,
                DiscountAmount: 0,
                FinalAmount: request.OrderAmount,
                Message: "Mã giảm giá này không áp dụng cho sự kiện hiện tại.",
                ErrorCode: "COUPON_EVENT_MISMATCH"
            );
        }

        var (isValid, discountAmount, errorCode, message) = coupon.CalculateDiscount(request.OrderAmount);

        if (!isValid)
        {
            return new ApplyCouponResult(
                Success: false,
                Code: normalizedCode,
                DiscountAmount: 0,
                FinalAmount: request.OrderAmount,
                Message: message ?? "Mã giảm giá không hợp lệ.",
                ErrorCode: errorCode ?? "COUPON_INVALID"
            );
        }

        var finalAmount = Math.Max(0, request.OrderAmount - discountAmount);

        return new ApplyCouponResult(
            Success: true,
            Code: coupon.Code,
            DiscountAmount: discountAmount,
            FinalAmount: finalAmount,
            Message: $"Áp dụng mã giảm giá {coupon.Code} thành công. Giảm {discountAmount:N0}đ.",
            ErrorCode: null
        );
    }
}

