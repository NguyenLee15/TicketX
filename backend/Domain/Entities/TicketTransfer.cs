namespace TickeX.Domain.Entities;

using TickeX.Domain.Enums;

public class TicketTransfer : BaseEntity
{
    public Guid TicketId { get; private set; }
    public Guid SenderUserId { get; private set; }
    public string RecipientEmail { get; private set; } = string.Empty;
    public Guid? RecipientUserId { get; private set; }
    public TransferStatus Status { get; private set; }
    public string? Note { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    public virtual Ticket? Ticket { get; private set; }
    public virtual User? SenderUser { get; private set; }
    public virtual User? RecipientUser { get; private set; }

    protected TicketTransfer() { }

    public TicketTransfer(Guid ticketId, Guid senderUserId, string recipientEmail, string? note = null)
    {
        if (ticketId == Guid.Empty)
            throw new ArgumentException("TicketId không được rỗng.", nameof(ticketId));

        if (senderUserId == Guid.Empty)
            throw new ArgumentException("SenderUserId không được rỗng.", nameof(senderUserId));

        if (string.IsNullOrWhiteSpace(recipientEmail))
            throw new ArgumentException("Email người nhận không được để trống.", nameof(recipientEmail));

        TicketId = ticketId;
        SenderUserId = senderUserId;
        RecipientEmail = recipientEmail.Trim().ToLowerInvariant();
        Note = note?.Trim();
        Status = TransferStatus.Pending;
    }

    public void Complete(Guid recipientUserId)
    {
        if (Status != TransferStatus.Pending)
            throw new InvalidOperationException("Giao dịch chuyển nhượng vé không còn ở trạng thái chờ.");

        RecipientUserId = recipientUserId;
        Status = TransferStatus.Completed;
        CompletedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Cancel()
    {
        if (Status != TransferStatus.Pending)
            throw new InvalidOperationException("Giao dịch chuyển nhượng vé không thể hủy.");

        Status = TransferStatus.Cancelled;
        UpdatedAt = DateTime.UtcNow;
    }
}

