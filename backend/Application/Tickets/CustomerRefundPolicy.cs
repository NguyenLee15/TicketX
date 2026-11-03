namespace TickeX.Application.Tickets;

public static class CustomerRefundPolicy
{
    public const int DefaultCutoffHours = 24;

    public static int NormalizeCutoffHours(int configuredCutoffHours) =>
        configuredCutoffHours >= 0 ? configuredCutoffHours : DefaultCutoffHours;

    public static DateTime GetAllowedUntil(DateTime eventStart, int configuredCutoffHours) =>
        eventStart.AddHours(-NormalizeCutoffHours(configuredCutoffHours));

    public static bool CanRefund(DateTime now, DateTime eventStart, int configuredCutoffHours) =>
        now <= GetAllowedUntil(eventStart, configuredCutoffHours);

    public record TieredRefundEstimate(
        decimal RefundPercentage,
        decimal RefundAmount,
        string PolicyTierDescription
    );

    public static TieredRefundEstimate CalculateTieredRefund(decimal ticketPrice, DateTime now, DateTime eventStart, int configuredCutoffHours)
    {
        var cutoffHours = NormalizeCutoffHours(configuredCutoffHours);
        var hoursRemaining = (eventStart - now).TotalHours;

        if (hoursRemaining < cutoffHours)
        {
            return new TieredRefundEstimate(0m, 0m, $"Đã quá hạn hoàn vé (Trước giờ diễn {cutoffHours}h).");
        }

        if (hoursRemaining >= 48)
        {
            return new TieredRefundEstimate(1.0m, ticketPrice, "Hoàn 100% (Trước sự kiện >= 48h)");
        }

        // Between 24h and 48h
        var amount70 = Math.Round(ticketPrice * 0.70m, 0);
        return new TieredRefundEstimate(0.70m, amount70, "Hoàn 70% (Trước sự kiện từ 24h đến 48h)");
    }
}
