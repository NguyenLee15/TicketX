namespace TickeX.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TickeX.Domain.Entities;

public class TicketTransferConfiguration : IEntityTypeConfiguration<TicketTransfer>
{
    public void Configure(EntityTypeBuilder<TicketTransfer> builder)
    {
        builder.ToTable("TicketTransfers");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.RecipientEmail)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(t => t.Note)
            .HasMaxLength(500);

        builder.Property(t => t.Status)
            .IsRequired();

        builder.HasOne(t => t.Ticket)
            .WithMany()
            .HasForeignKey(t => t.TicketId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(t => t.SenderUser)
            .WithMany()
            .HasForeignKey(t => t.SenderUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(t => t.RecipientUser)
            .WithMany()
            .HasForeignKey(t => t.RecipientUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(t => t.TicketId);
        builder.HasIndex(t => t.SenderUserId);
        builder.HasIndex(t => t.RecipientEmail);
    }
}

