namespace TickeX.Domain.Entities;

public class PaymentTransaction : BaseEntity
{
    public long OrderCode { get; private set; }
    public Guid TicketId { get; private set; }
    public decimal Amount { get; private set; }
    public string Provider { get; private set; } = "PayOS"; // PayOS, VietQR, etc.
    public string ProviderTransactionId { get; private set; } = string.Empty;
    public string Status { get; private set; } = "Pending"; // Pending, Success, Failed, RefundInitiated, Refunded, RefundFailed
    public string RawWebhookPayload { get; private set; } = string.Empty;
    public string WebhookPayloadHash { get; private set; } = string.Empty;
    public string CheckoutUrl { get; private set; } = string.Empty;
    public string? AppliedCouponCode { get; private set; }
    public decimal DiscountAmount { get; private set; } = 0;
    public DateTime ProcessedAt { get; private set; } = DateTime.UtcNow;
    public byte[] Version { get; private set; } = Guid.NewGuid().ToByteArray();

    private PaymentTransaction() { } // For EF Core

    public PaymentTransaction(
        long orderCode, 
        Guid ticketId, 
        decimal amount, 
        string provider = "PayOS",
        string? appliedCouponCode = null,
        decimal discountAmount = 0)
    {
        OrderCode = orderCode;
        TicketId = ticketId;
        Amount = amount;
        Provider = provider;
        AppliedCouponCode = !string.IsNullOrWhiteSpace(appliedCouponCode) ? appliedCouponCode.Trim().ToUpperInvariant() : null;
        DiscountAmount = Math.Max(0, discountAmount);
        Status = "Pending";
        ProcessedAt = DateTime.UtcNow;
    }

    public void ApplyCoupon(string couponCode, decimal discountAmount)
    {
        AppliedCouponCode = couponCode.Trim().ToUpperInvariant();
        DiscountAmount = Math.Max(0, discountAmount);
        Amount = Math.Max(0, Amount - DiscountAmount);
        Touch();
    }

    public void MarkSuccess(string providerTxId, string rawPayload = "")
    {
        Status = "Success";
        ProviderTransactionId = providerTxId;
        RawWebhookPayload = rawPayload;
        ProcessedAt = DateTime.UtcNow;
        Touch();
    }

    public void SetCheckoutUrl(string checkoutUrl)
    {
        CheckoutUrl = checkoutUrl;
        Touch();
    }

    public void SetWebhookPayloadHash(string payloadHash)
    {
        WebhookPayloadHash = payloadHash.Length <= 64 ? payloadHash : payloadHash[..64];
        Touch();
    }

    public void MarkFailed(string reason, string rawPayload = "")
    {
        Status = "Failed";
        RawWebhookPayload = $"{reason} | {rawPayload}";
        ProcessedAt = DateTime.UtcNow;
        Touch();
    }

    public void ResetPending()
    {
        Status = "Pending";
        CheckoutUrl = string.Empty;
        ProcessedAt = DateTime.UtcNow;
        Touch();
    }

    public void MarkRefundInitiated(string rawPayload = "")
    {
        Status = "RefundInitiated";
        RawWebhookPayload = rawPayload;
        ProcessedAt = DateTime.UtcNow;
        Touch();
    }

    public void MarkRefunded(string refundTxId = "", string rawPayload = "")
    {
        Status = "Refunded";
        if (!string.IsNullOrEmpty(refundTxId))
            ProviderTransactionId = refundTxId;
        if (!string.IsNullOrEmpty(rawPayload))
            RawWebhookPayload = rawPayload;
        ProcessedAt = DateTime.UtcNow;
        Touch();
    }

    public void MarkRefundFailed(string reason, string rawPayload = "")
    {
        Status = "RefundFailed";
        RawWebhookPayload = $"{reason} | {rawPayload}";
        ProcessedAt = DateTime.UtcNow;
        Touch();
    }

    public void MarkOrphaned(string reason, string providerTxId, string rawPayload = "")
    {
        Status = "OrphanedPaid";
        ProviderTransactionId = providerTxId;
        RawWebhookPayload = $"{reason} | {rawPayload}";
        ProcessedAt = DateTime.UtcNow;
        Touch();
    }

    private void Touch()
    {
        UpdatedAt = DateTime.UtcNow;
        Version = Guid.NewGuid().ToByteArray();
    }
}
