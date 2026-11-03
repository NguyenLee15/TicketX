namespace TickeX.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TickeX.Domain.Entities;

public class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> builder)
    {
        builder.ToTable("Invoices");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.OrderCode)
            .IsRequired();

        builder.Property(i => i.TaxCode)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(i => i.CompanyName)
            .IsRequired()
            .HasMaxLength(250);

        builder.Property(i => i.CompanyAddress)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(i => i.RecipientEmail)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(i => i.SubTotal)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(i => i.VatRate)
            .HasPrecision(5, 4)
            .IsRequired();

        builder.Property(i => i.VatAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(i => i.TotalAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(i => i.InvoiceNumber)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(i => i.InvoiceLookupCode)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(i => i.Status)
            .IsRequired();

        builder.Property(i => i.Version)
            .IsConcurrencyToken()
            .HasMaxLength(64);

        builder.HasIndex(i => i.OrderCode);
        builder.HasIndex(i => i.UserId);
        builder.HasIndex(i => i.InvoiceLookupCode).IsUnique();
        builder.HasIndex(i => i.InvoiceNumber).IsUnique();
    }
}
