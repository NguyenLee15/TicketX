namespace TickeX.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TickeX.Domain.Entities;

public class CouponConfiguration : IEntityTypeConfiguration<Coupon>
{
    public void Configure(EntityTypeBuilder<Coupon> builder)
    {
        builder.ToTable("Coupons");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Code)
            .IsRequired()
            .HasMaxLength(50);

        builder.HasIndex(c => c.Code)
            .IsUnique();

        builder.HasIndex(c => new { c.Code, c.IsActive });
        builder.HasIndex(c => new { c.IsActive, c.ValidFrom, c.ValidTo });

        builder.Property(c => c.Description)
            .HasMaxLength(255);

        builder.Property(c => c.DiscountType)
            .IsRequired();

        builder.Property(c => c.DiscountValue)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(c => c.MaxDiscountAmount)
            .HasPrecision(18, 2);

        builder.Property(c => c.MinOrderAmount)
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        builder.Property(c => c.UsageLimit)
            .IsRequired();

        builder.Property(c => c.UsedCount)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(c => c.ValidFrom)
            .IsRequired();

        builder.Property(c => c.ValidTo)
            .IsRequired();

        builder.Property(c => c.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(c => c.Version)
            .IsConcurrencyToken();

        builder.HasOne(c => c.Event)
            .WithMany()
            .HasForeignKey(c => c.EventId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
