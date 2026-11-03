namespace TickeX.Domain.Entities;

using TickeX.Domain.Enums;

public class Settlement : BaseEntity
{
    public Guid EventId { get; private set; }
    public Guid OrganizerId { get; private set; }

    public decimal GrossRevenue { get; private set; }
    public decimal CommissionRate { get; private set; } // e.g. 0.05m = 5%
    public decimal CommissionAmount { get; private set; }
    public decimal RefundDeduction { get; private set; }
    public decimal NetPayout { get; private set; }

    public string BankName { get; private set; } = string.Empty;
    public string BankAccountNumber { get; private set; } = string.Empty;
    public string AccountHolder { get; private set; } = string.Empty;

    public SettlementStatus Status { get; private set; }
    public string? AdminNote { get; private set; }
    public DateTime RequestedAt { get; private set; }
    public DateTime? ProcessedAt { get; private set; }

    public byte[] Version { get; private set; } = Guid.NewGuid().ToByteArray();

    public virtual Event? Event { get; private set; }
    public virtual User? Organizer { get; private set; }

    protected Settlement() { }

    public Settlement(
        Guid eventId,
        Guid organizerId,
        decimal grossRevenue,
        decimal commissionRate,
        decimal refundDeduction,
        string bankName,
        string bankAccountNumber,
        string accountHolder)
    {
        if (eventId == Guid.Empty)
            throw new ArgumentException("Mã sự kiện không được để trống.", nameof(eventId));

        if (organizerId == Guid.Empty)
            throw new ArgumentException("Mã ban tổ chức không được để trống.", nameof(organizerId));

        if (grossRevenue < 0)
            throw new ArgumentException("Doanh thu gộp không thể âm.", nameof(grossRevenue));

        if (commissionRate < 0 || commissionRate > 1)
            throw new ArgumentException("Tỷ lệ hoa hồng phải từ 0% đến 100%.", nameof(commissionRate));

        if (refundDeduction < 0)
            throw new ArgumentException("Số tiền hoàn trả không thể âm.", nameof(refundDeduction));

        if (string.IsNullOrWhiteSpace(bankName))
            throw new ArgumentException("Tên ngân hàng không được để trống.", nameof(bankName));

        if (string.IsNullOrWhiteSpace(bankAccountNumber))
            throw new ArgumentException("Số tài khoản không được để trống.", nameof(bankAccountNumber));

        if (string.IsNullOrWhiteSpace(accountHolder))
            throw new ArgumentException("Tên chủ tài khoản không được để trống.", nameof(accountHolder));

        EventId = eventId;
        OrganizerId = organizerId;
        GrossRevenue = grossRevenue;
        CommissionRate = commissionRate;
        CommissionAmount = Math.Round(grossRevenue * commissionRate, 0);
        RefundDeduction = refundDeduction;

        var calculatedNet = grossRevenue - CommissionAmount - refundDeduction;
        NetPayout = calculatedNet > 0 ? calculatedNet : 0m;

        BankName = bankName.Trim();
        BankAccountNumber = bankAccountNumber.Trim();
        AccountHolder = accountHolder.Trim().ToUpperInvariant();

        Status = SettlementStatus.Pending;
        RequestedAt = DateTime.UtcNow;
        Version = Guid.NewGuid().ToByteArray();
    }

    public void Approve(string? adminNote = null)
    {
        if (Status != SettlementStatus.Pending)
            throw new InvalidOperationException($"Chỉ có thể phê duyệt yêu cầu quyết toán ở trạng thái Chờ xử lý (Trạng thái hiện tại: {Status}).");

        Status = SettlementStatus.Approved;
        AdminNote = adminNote?.Trim();
        ProcessedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
        Version = Guid.NewGuid().ToByteArray();
    }

    public void Complete(string? adminNote = null)
    {
        if (Status != SettlementStatus.Pending && Status != SettlementStatus.Approved)
            throw new InvalidOperationException($"Không thể hoàn tất quyết toán ở trạng thái {Status}.");

        Status = SettlementStatus.Completed;
        if (!string.IsNullOrWhiteSpace(adminNote))
        {
            AdminNote = adminNote.Trim();
        }
        ProcessedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
        Version = Guid.NewGuid().ToByteArray();
    }

    public void Reject(string reason)
    {
        if (Status != SettlementStatus.Pending)
            throw new InvalidOperationException($"Chỉ có thể từ chối yêu cầu quyết toán ở trạng thái Chờ xử lý (Trạng thái hiện tại: {Status}).");

        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Lý do từ chối quyết toán không được để trống.", nameof(reason));

        Status = SettlementStatus.Rejected;
        AdminNote = reason.Trim();
        ProcessedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
        Version = Guid.NewGuid().ToByteArray();
    }
}

