namespace TickeX.Infrastructure.Services;

using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using TickeX.Application.Interfaces;

public class TotpService : ITotpService
{
    private const int DefaultStepSeconds = 30;
    private readonly byte[] _masterKey;

    public TotpService(IConfiguration configuration)
    {
        var secret = configuration["TicketSecurity:Secret"] 
            ?? configuration["TicketSecurity:ActiveKeyId"] 
            ?? "TickeX-Default-Enterprise-Security-Secret-Key-2026";
        _masterKey = Encoding.UTF8.GetBytes(secret);
    }

    // Helper constructor for testing with explicit key
    public TotpService(string secretKey)
    {
        _masterKey = Encoding.UTF8.GetBytes(secretKey);
    }

    private byte[] DeriveTicketSecret(Guid ticketId)
    {
        using var hmac = new HMACSHA256(_masterKey);
        return hmac.ComputeHash(Encoding.UTF8.GetBytes(ticketId.ToString("N")));
    }

    private string ComputeTotpCode(byte[] ticketSecret, long timeStep)
    {
        var counterBytes = BitConverter.GetBytes(timeStep);
        if (BitConverter.IsLittleEndian)
        {
            Array.Reverse(counterBytes);
        }

        using var hmac = new HMACSHA256(ticketSecret);
        var hash = hmac.ComputeHash(counterBytes);

        var offset = hash[^1] & 0x0F;
        var binary = ((hash[offset] & 0x7F) << 24)
                   | ((hash[offset + 1] & 0xFF) << 16)
                   | ((hash[offset + 2] & 0xFF) << 8)
                   | (hash[offset + 3] & 0xFF);

        var otp = binary % 1_000_000;
        return otp.ToString("D6");
    }

    private string ComputeSignature(byte[] ticketSecret, Guid ticketId, string totpCode)
    {
        using var hmac = new HMACSHA256(ticketSecret);
        var sigBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{ticketId:N}:{totpCode}"));
        return Convert.ToHexString(sigBytes).ToLowerInvariant()[..16];
    }

    public string GenerateDynamicToken(Guid ticketId, DateTime? utcNow = null)
    {
        var now = utcNow ?? DateTime.UtcNow;
        var unixTime = new DateTimeOffset(now).ToUnixTimeSeconds();
        var timeStep = unixTime / DefaultStepSeconds;

        var ticketSecret = DeriveTicketSecret(ticketId);
        var totpCode = ComputeTotpCode(ticketSecret, timeStep);
        var sig = ComputeSignature(ticketSecret, ticketId, totpCode);

        return $"TICKEX-TOTP:{ticketId:N}:{totpCode}:{sig}";
    }

    public DynamicQrResult GetDynamicQr(Guid ticketId, DateTime? utcNow = null)
    {
        var now = utcNow ?? DateTime.UtcNow;
        var unixTime = new DateTimeOffset(now).ToUnixTimeSeconds();
        var remaining = DefaultStepSeconds - (int)(unixTime % DefaultStepSeconds);
        if (remaining <= 0) remaining = DefaultStepSeconds;

        var token = GenerateDynamicToken(ticketId, now);
        var expiresAt = now.AddSeconds(remaining);

        return new DynamicQrResult(
            QrToken: token,
            RemainingSeconds: remaining,
            StepSeconds: DefaultStepSeconds,
            ExpiresAt: expiresAt
        );
    }

    public (bool IsValid, Guid TicketId, string? ErrorReason) ValidateDynamicToken(string dynamicQrToken, DateTime? utcNow = null)
    {
        if (string.IsNullOrWhiteSpace(dynamicQrToken))
            return (false, Guid.Empty, "Mã QR không được để trống.");

        var parts = dynamicQrToken.Trim().Split(':');
        if (parts.Length != 4 || parts[0] != "TICKEX-TOTP")
            return (false, Guid.Empty, "Định dạng mã QR động không hợp lệ.");

        if (!Guid.TryParseExact(parts[1], "N", out var ticketId))
            return (false, Guid.Empty, "Mã định danh vé trong QR không hợp lệ.");

        var totpCode = parts[2];
        var signature = parts[3];

        if (totpCode.Length != 6)
            return (false, ticketId, "Mã xác thực TOTP không đúng định dạng 6 chữ số.");

        var ticketSecret = DeriveTicketSecret(ticketId);
        var expectedSig = ComputeSignature(ticketSecret, ticketId, totpCode);

        if (!CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(signature), 
            Encoding.UTF8.GetBytes(expectedSig)))
        {
            return (false, ticketId, "Chữ ký số của mã QR động không hợp lệ.");
        }

        var now = utcNow ?? DateTime.UtcNow;
        var unixTime = new DateTimeOffset(now).ToUnixTimeSeconds();
        var currentStep = unixTime / DefaultStepSeconds;

        // Check window [-1, 0, +1] to tolerate network clock skew
        for (var stepOffset = -1; stepOffset <= 1; stepOffset++)
        {
            var validCode = ComputeTotpCode(ticketSecret, currentStep + stepOffset);
            if (CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(totpCode), 
                Encoding.UTF8.GetBytes(validCode)))
            {
                return (true, ticketId, null);
            }
        }

        return (false, ticketId, "Mã QR động đã hết hạn (chỉ có hiệu lực trong 30 giây). Vui lòng sử dụng mã mới.");
    }
}

