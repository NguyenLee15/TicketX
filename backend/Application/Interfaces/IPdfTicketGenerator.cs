namespace TickeX.Application.Interfaces;

public interface IPdfTicketGenerator
{
    byte[] GenerateTicketPdf(
        string eventTitle,
        DateTime eventDate,
        string venueName,
        string location,
        string seatRow,
        int seatNumber,
        string seatTier,
        decimal price,
        long orderCode,
        string qrCodeSignature,
        string customerName);
}

