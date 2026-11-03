namespace TickeX.Application.Interfaces;

public record DynamicQrResult(
    string QrToken,
    int RemainingSeconds,
    int StepSeconds,
    DateTime ExpiresAt
);

public interface ITotpService
{
    string GenerateDynamicToken(Guid ticketId, DateTime? utcNow = null);
    (bool IsValid, Guid TicketId, string? ErrorReason) ValidateDynamicToken(string dynamicQrToken, DateTime? utcNow = null);
    DynamicQrResult GetDynamicQr(Guid ticketId, DateTime? utcNow = null);
}

