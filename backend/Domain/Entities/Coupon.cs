namespace TickeX.Domain.Entities;

using TickeX.Domain.Enums;

public class Coupon : BaseEntity
{
    public string Code { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public DiscountType DiscountType { get; private set; }
    public decimal DiscountValue { get; private set; }
    public decimal? MaxDiscountAmount { get; private set; }
    public decimal MinOrderAmount { get; private set; }
    public int UsageLimit { get; private set; }
    public int UsedCount { get; private set; }
    public DateTime ValidFrom { get; private set; }
    public DateTime ValidTo { get; private set; }
    public Guid? EventId { get; private set; }
    public bool IsActive { get; private set; }
    public byte[] Version { get; private set; } = Guid.NewGuid().ToByteArray();

    public virtual Event? Event { get; private set; }

    protected Coupon() { }

    public Coupon(
        string code,
        string description,
        DiscountType discountType,
        decimal discountValue,
        decimal? maxDiscountAmount,
        decimal minOrderAmount,
        int usageLimit,
        DateTime validFrom,
        DateTime validTo,
        Guid? eventId = null)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new ArgumentException("Mã giảm giá không được để trống.", nameof(code));

        if (discountValue <= 0)
            throw new ArgumentException("Giá trị giảm giá phải lớn hơn 0.", nameof(discountValue));

        if (discountType == DiscountType.Percentage && discountValue > 100)
            throw new ArgumentException("Phần trăm giảm giá không được vượt quá 100%.", nameof(discountValue));

        if (validTo <= validFrom)
            throw new ArgumentException("Thời hạn kết thúc phải sau thời gian bắt đầu.", nameof(validTo));

        if (usageLimit <= 0)
            throw new ArgumentException("Số lượt sử dụng phải lớn hơn 0.", nameof(usageLimit));

        Code = code.Trim().ToUpperInvariant();
        Description = description?.Trim() ?? string.Empty;
        DiscountType = discountType;
        DiscountValue = discountValue;
        MaxDiscountAmount = maxDiscountAmount;
        MinOrderAmount = Math.Max(0, minOrderAmount);
        UsageLimit = usageLimit;
        UsedCount = 0;
        ValidFrom = validFrom;
        ValidTo = validTo;
        EventId = eventId;
        IsActive = true;
    }

    public (bool IsValid, decimal DiscountAmount, string? ErrorCode, string? Message) CalculateDiscount(decimal orderAmount, DateTime? utcNow = null)
    {
        var now = utcNow ?? DateTime.UtcNow;

        if (!IsActive)
            return (false, 0, "COUPON_INACTIVE", "Mã giảm giá hiện đang bị tạm khóa.");

        if (now < ValidFrom)
            return (false, 0, "COUPON_NOT_STARTED", "Mã giảm giá chưa đến đợt áp dụng.");

        if (now > ValidTo)
            return (false, 0, "COUPON_EXPIRED", "Mã giảm giá đã hết hạn sử dụng.");

        if (UsedCount >= UsageLimit)
            return (false, 0, "COUPON_USAGE_EXCEEDED", "Mã giảm giá đã hết lượt sử dụng.");

        if (orderAmount < MinOrderAmount)
            return (false, 0, "ORDER_BELOW_MINIMUM", $"Đơn hàng tối thiểu phải từ {MinOrderAmount:N0}đ để sử dụng mã này.");

        decimal discount;
        if (DiscountType == DiscountType.Percentage)
        {
            discount = orderAmount * (DiscountValue / 100m);
            if (MaxDiscountAmount.HasValue && discount > MaxDiscountAmount.Value)
            {
                discount = MaxDiscountAmount.Value;
            }
        }
        else
        {
            discount = Math.Min(DiscountValue, orderAmount);
        }

        var finalDiscount = Math.Round(discount, 0, MidpointRounding.AwayFromZero);
        return (true, finalDiscount, null, null);
    }

    public void Use()
    {
        if (UsedCount >= UsageLimit)
            throw new InvalidOperationException("Mã giảm giá đã hết lượt sử dụng.");

        UsedCount++;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate()
    {
        IsActive = true;
        UpdatedAt = DateTime.UtcNow;
    }
}
