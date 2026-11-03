namespace TickeX.UnitTests.Coupons;

using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Coupons.Commands;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using TickeX.Infrastructure.Persistence;
using Xunit;

public class CouponEngineTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ApplicationDbContext _context;

    public CouponEngineTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options;

        _context = new ApplicationDbContext(options);
        _context.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public void Percentage_Discount_Calculates_Correctly()
    {
        var coupon = new Coupon(
            code: "SALE10",
            description: "Giảm 10%",
            discountType: DiscountType.Percentage,
            discountValue: 10,
            maxDiscountAmount: null,
            minOrderAmount: 100000,
            usageLimit: 100,
            validFrom: DateTime.UtcNow.AddDays(-1),
            validTo: DateTime.UtcNow.AddDays(1)
        );

        var (isValid, discount, _, _) = coupon.CalculateDiscount(500000);

        Assert.True(isValid);
        Assert.Equal(50000, discount);
    }

    [Fact]
    public void Percentage_Discount_Caps_At_MaxDiscountAmount()
    {
        var coupon = new Coupon(
            code: "MAX50K",
            description: "Giảm 50% tối đa 50k",
            discountType: DiscountType.Percentage,
            discountValue: 50,
            maxDiscountAmount: 50000,
            minOrderAmount: 0,
            usageLimit: 50,
            validFrom: DateTime.UtcNow.AddDays(-1),
            validTo: DateTime.UtcNow.AddDays(1)
        );

        // 50% of 200k is 100k, capped at 50k
        var (isValid, discount, _, _) = coupon.CalculateDiscount(200000);

        Assert.True(isValid);
        Assert.Equal(50000, discount);
    }

    [Fact]
    public void FixedAmount_Discount_Cannot_Exceed_OrderAmount()
    {
        var coupon = new Coupon(
            code: "FIXED100K",
            description: "Giảm 100k",
            discountType: DiscountType.FixedAmount,
            discountValue: 100000,
            maxDiscountAmount: null,
            minOrderAmount: 0,
            usageLimit: 10,
            validFrom: DateTime.UtcNow.AddDays(-1),
            validTo: DateTime.UtcNow.AddDays(1)
        );

        var (isValid1, discount1, _, _) = coupon.CalculateDiscount(300000);
        Assert.True(isValid1);
        Assert.Equal(100000, discount1);

        // Order amount 60k < discount 100k -> discount becomes 60k (order cannot be negative)
        var (isValid2, discount2, _, _) = coupon.CalculateDiscount(60000);
        Assert.True(isValid2);
        Assert.Equal(60000, discount2);
    }

    [Fact]
    public void Order_Below_Minimum_Returns_Error()
    {
        var coupon = new Coupon(
            code: "MIN300K",
            description: "Đơn từ 300k",
            discountType: DiscountType.FixedAmount,
            discountValue: 50000,
            maxDiscountAmount: null,
            minOrderAmount: 300000,
            usageLimit: 100,
            validFrom: DateTime.UtcNow.AddDays(-1),
            validTo: DateTime.UtcNow.AddDays(1)
        );

        var (isValid, discount, errorCode, _) = coupon.CalculateDiscount(250000);

        Assert.False(isValid);
        Assert.Equal(0, discount);
        Assert.Equal("ORDER_BELOW_MINIMUM", errorCode);
    }

    [Fact]
    public void Expired_Coupon_Returns_Error()
    {
        var coupon = new Coupon(
            code: "EXPIRED",
            description: "Hết hạn",
            discountType: DiscountType.FixedAmount,
            discountValue: 20000,
            maxDiscountAmount: null,
            minOrderAmount: 0,
            usageLimit: 100,
            validFrom: DateTime.UtcNow.AddDays(-10),
            validTo: DateTime.UtcNow.AddDays(-1)
        );

        var (isValid, _, errorCode, _) = coupon.CalculateDiscount(100000);

        Assert.False(isValid);
        Assert.Equal("COUPON_EXPIRED", errorCode);
    }

    [Fact]
    public void Exceeded_Usage_Returns_Error()
    {
        var coupon = new Coupon(
            code: "LIMITED",
            description: "Chỉ 1 lượt",
            discountType: DiscountType.FixedAmount,
            discountValue: 20000,
            maxDiscountAmount: null,
            minOrderAmount: 0,
            usageLimit: 1,
            validFrom: DateTime.UtcNow.AddDays(-1),
            validTo: DateTime.UtcNow.AddDays(1)
        );

        coupon.Use();

        var (isValid, _, errorCode, _) = coupon.CalculateDiscount(100000);

        Assert.False(isValid);
        Assert.Equal("COUPON_USAGE_EXCEEDED", errorCode);
    }

    [Fact]
    public async Task ApplyCouponCommandHandler_Event_Mismatch_Fails()
    {
        var ev = new Event(
            title: "Concert Test A",
            description: "Mô tả",
            date: DateTime.UtcNow.AddDays(10),
            endDate: DateTime.UtcNow.AddDays(10).AddHours(3),
            location: "Hà Nội",
            venueName: "Sân vận động Mỹ Đình",
            totalSeats: 100
        );
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var otherEventId = Guid.NewGuid();

        var coupon = new Coupon(
            code: "EVENTSPECIFIC",
            description: "Chỉ cho sự kiện A",
            discountType: DiscountType.Percentage,
            discountValue: 15,
            maxDiscountAmount: null,
            minOrderAmount: 0,
            usageLimit: 10,
            validFrom: DateTime.UtcNow.AddDays(-1),
            validTo: DateTime.UtcNow.AddDays(1),
            eventId: ev.Id
        );

        _context.Coupons.Add(coupon);
        await _context.SaveChangesAsync();

        var handler = new ApplyCouponCommandHandler(_context);
        var result = await handler.Handle(new ApplyCouponCommand("EVENTSPECIFIC", 200000, otherEventId), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("COUPON_EVENT_MISMATCH", result.ErrorCode);
    }

    [Fact]
    public void Coupon_Use_Increments_UsedCount_And_Enforces_Limit()
    {
        var coupon = new Coupon(
            code: "LIMITEDUSE",
            description: "Chỉ dùng 2 lần",
            discountType: DiscountType.FixedAmount,
            discountValue: 20000,
            maxDiscountAmount: null,
            minOrderAmount: 0,
            usageLimit: 2,
            validFrom: DateTime.UtcNow.AddDays(-1),
            validTo: DateTime.UtcNow.AddDays(1)
        );

        Assert.Equal(0, coupon.UsedCount);

        coupon.Use();
        Assert.Equal(1, coupon.UsedCount);

        coupon.Use();
        Assert.Equal(2, coupon.UsedCount);

        // Third use must throw InvalidOperationException
        Assert.Throws<InvalidOperationException>(() => coupon.Use());
    }

    [Fact]
    public void PaymentTransaction_ApplyCoupon_Updates_Amount_And_Discount()
    {
        var tx = new PaymentTransaction(123456, Guid.NewGuid(), 250000, "VietQR_PayOS");
        Assert.Equal(250000, tx.Amount);
        Assert.Null(tx.AppliedCouponCode);
        Assert.Equal(0, tx.DiscountAmount);

        tx.ApplyCoupon("DISCOUNT50", 50000);
        Assert.Equal(200000, tx.Amount);
        Assert.Equal("DISCOUNT50", tx.AppliedCouponCode);
        Assert.Equal(50000, tx.DiscountAmount);
    }
}
