namespace TickeX.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TickeX.Domain.Entities;

public class SettlementConfiguration : IEntityTypeConfiguration<Settlement>
{
    public void Configure(EntityTypeBuilder<Settlement> builder)
    {
        builder.ToTable("Settlements");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.GrossRevenue)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(s => s.CommissionRate)
            .HasPrecision(5, 4)
            .IsRequired();

        builder.Property(s => s.CommissionAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(s => s.RefundDeduction)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(s => s.NetPayout)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(s => s.BankName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(s => s.BankAccountNumber)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(s => s.AccountHolder)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(s => s.AdminNote)
            .HasMaxLength(1000);

        builder.Property(s => s.Status)
            .IsRequired();

        builder.Property(s => s.Version)
            .IsRequired()
            .IsConcurrencyToken();

        builder.HasOne(s => s.Event)
            .WithMany()
            .HasForeignKey(s => s.EventId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.Organizer)
            .WithMany()
            .HasForeignKey(s => s.OrganizerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(s => s.EventId);
        builder.HasIndex(s => s.OrganizerId);
        builder.HasIndex(s => s.Status);
    }
}
