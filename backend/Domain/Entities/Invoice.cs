using System.Security.Cryptography;
using TickeX.Domain.Enums;

namespace TickeX.Domain.Entities;

public class Invoice : BaseEntity
{
    public long OrderCode { get; private set; }
    public Guid UserId { get; private set; }
    public string TaxCode { get; private set; } = string.Empty;
    public string CompanyName { get; private set; } = string.Empty;
    public string CompanyAddress { get; private set; } = string.Empty;
    public string RecipientEmail { get; private set; } = string.Empty;
    public decimal SubTotal { get; private set; }
    public decimal VatRate { get; private set; }
    public decimal VatAmount { get; private set; }
    public decimal TotalAmount { get; private set; }
    public string InvoiceNumber { get; private set; } = string.Empty;
    public string InvoiceLookupCode { get; private set; } = string.Empty;
    public InvoiceStatus Status { get; private set; }
    public DateTime? IssuedAt { get; private set; }
    public string Version { get; private set; } = Guid.NewGuid().ToString("N");

    // EF Core Constructor
    private Invoice() { }

    public Invoice(
        long orderCode,
        Guid userId,
        string taxCode,
        string companyName,
        string companyAddress,
        string recipientEmail,
        decimal totalAmount,
        decimal vatRate = 0.10m)
    {
        if (orderCode <= 0) throw new ArgumentException("Mã đơn hàng không hợp lệ.", nameof(orderCode));
        if (userId == Guid.Empty) throw new ArgumentException("Mã người dùng không hợp lệ.", nameof(userId));
        if (string.IsNullOrWhiteSpace(taxCode)) throw new ArgumentException("Mã số thuế không được để trống.", nameof(taxCode));
        if (string.IsNullOrWhiteSpace(companyName)) throw new ArgumentException("Tên công ty không được để trống.", nameof(companyName));
        if (string.IsNullOrWhiteSpace(companyAddress)) throw new ArgumentException("Địa chỉ công ty không được để trống.", nameof(companyAddress));
        if (string.IsNullOrWhiteSpace(recipientEmail)) throw new ArgumentException("Email nhận hóa đơn không được để trống.", nameof(recipientEmail));
        if (totalAmount <= 0) throw new ArgumentException("Tổng tiền hóa đơn phải lớn hơn 0.", nameof(totalAmount));
        if (vatRate < 0 || vatRate > 0.30m) throw new ArgumentException("Thuế suất VAT không hợp lệ.", nameof(vatRate));

        OrderCode = orderCode;
        UserId = userId;
        TaxCode = taxCode.Trim().Replace(" ", "");
        CompanyName = companyName.Trim();
        CompanyAddress = companyAddress.Trim();
        RecipientEmail = recipientEmail.Trim().ToLowerInvariant();
        VatRate = vatRate;

        // SubTotal + VatAmount = TotalAmount
        // SubTotal = TotalAmount / (1 + VatRate)
        SubTotal = Math.Round(totalAmount / (1 + vatRate), 2, MidpointRounding.AwayFromZero);
        VatAmount = totalAmount - SubTotal;
        TotalAmount = totalAmount;

        InvoiceNumber = $"HD{DateTime.UtcNow:yyyyMMdd}-{RandomNumberGenerator.GetInt32(100000, 999999)}";
        InvoiceLookupCode = GenerateLookupCode();
        Status = InvoiceStatus.Issued;
        IssuedAt = DateTime.UtcNow;
    }

    private static string GenerateLookupCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var buffer = new char[8];
        for (int i = 0; i < buffer.Length; i++)
        {
            buffer[i] = chars[RandomNumberGenerator.GetInt32(chars.Length)];
        }
        return new string(buffer);
    }

    public void Cancel(string reason)
    {
        if (Status == InvoiceStatus.Cancelled)
            return;

        Status = InvoiceStatus.Cancelled;
        UpdatedAt = DateTime.UtcNow;
        Version = Guid.NewGuid().ToString("N");
    }
}
