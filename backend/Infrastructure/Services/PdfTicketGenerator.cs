using System.Text;
using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Services;

public sealed class PdfTicketGenerator : IPdfTicketGenerator
{
    public byte[] GenerateTicketPdf(
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
        string customerName)
    {
        var cleanTitle = EscapePdfText(RemoveDiacritics(eventTitle));
        var cleanVenue = EscapePdfText(RemoveDiacritics(venueName));
        var cleanLocation = EscapePdfText(RemoveDiacritics(location));
        var cleanCustomer = EscapePdfText(RemoveDiacritics(customerName));
        var cleanRow = EscapePdfText(seatRow);
        var cleanTier = EscapePdfText(seatTier);
        var cleanPrice = $"{price:N0} VND";
        var dateFormatted = eventDate.ToString("dd/MM/yyyy HH:mm");
        var shortQr = qrCodeSignature.Length > 64 ? qrCodeSignature[..64] + "..." : qrCodeSignature;
        var cleanQr = EscapePdfText(shortQr);

        // Build PDF Content Stream (PostScript operators)
        var sb = new StringBuilder();
        sb.AppendLine("q");
        
        // Header background banner (Dark Navy)
        sb.AppendLine("0.07 0.09 0.15 rg 40 730 515 70 re f");

        // Header Title
        sb.AppendLine("BT /F1 20 Tf 1 1 1 rg 60 760 Td (TICKEX ELECTRONIC TICKET) Tj ET");
        sb.AppendLine("BT /F2 10 Tf 0.8 0.85 0.9 rg 60 742 Td (OFFICIAL SECURE ADMISSION PASS) Tj ET");

        // Outer ticket frame
        sb.AppendLine("0.85 0.88 0.92 RG 1 w 40 180 515 530 re s");

        // Event Title
        sb.AppendLine("BT /F1 16 Tf 0.07 0.09 0.15 rg 60 675 Td (" + cleanTitle + ") Tj ET");

        // Decorative separator line
        sb.AppendLine("0.85 0.88 0.92 RG 0.75 w 60 655 m 535 655 l S");

        // Event Metadata
        sb.AppendLine("BT /F1 11 Tf 0.3 0.35 0.4 rg 60 630 Td (DATE & TIME:) Tj ET");
        sb.AppendLine("BT /F2 12 Tf 0.07 0.09 0.15 rg 160 630 Td (" + dateFormatted + ") Tj ET");

        sb.AppendLine("BT /F1 11 Tf 0.3 0.35 0.4 rg 60 600 Td (VENUE:) Tj ET");
        sb.AppendLine("BT /F2 12 Tf 0.07 0.09 0.15 rg 160 600 Td (" + cleanVenue + ") Tj ET");

        sb.AppendLine("BT /F1 11 Tf 0.3 0.35 0.4 rg 60 570 Td (LOCATION:) Tj ET");
        sb.AppendLine("BT /F2 12 Tf 0.07 0.09 0.15 rg 160 570 Td (" + cleanLocation + ") Tj ET");

        // Seat details box (Light Indigo fill)
        sb.AppendLine("0.95 0.96 0.98 rg 60 480 475 70 re f");
        sb.AppendLine("0.8 0.85 0.9 RG 0.75 w 60 480 475 70 re s");

        sb.AppendLine("BT /F1 10 Tf 0.3 0.35 0.4 rg 80 525 Td (SEAT TIER) Tj ET");
        sb.AppendLine("BT /F1 14 Tf 0.15 0.25 0.65 rg 80 500 Td (" + cleanTier.ToUpperInvariant() + ") Tj ET");

        sb.AppendLine("BT /F1 10 Tf 0.3 0.35 0.4 rg 220 525 Td (ROW) Tj ET");
        sb.AppendLine("BT /F1 14 Tf 0.07 0.09 0.15 rg 220 500 Td (" + cleanRow + ") Tj ET");

        sb.AppendLine("BT /F1 10 Tf 0.3 0.35 0.4 rg 320 525 Td (SEAT NUMBER) Tj ET");
        sb.AppendLine("BT /F1 14 Tf 0.07 0.09 0.15 rg 320 500 Td (" + seatNumber + ") Tj ET");

        sb.AppendLine("BT /F1 10 Tf 0.3 0.35 0.4 rg 420 525 Td (PRICE) Tj ET");
        sb.AppendLine("BT /F1 14 Tf 0.05 0.5 0.2 rg 420 500 Td (" + cleanPrice + ") Tj ET");

        // Customer & Order Info
        sb.AppendLine("BT /F1 11 Tf 0.3 0.35 0.4 rg 60 440 Td (CUSTOMER:) Tj ET");
        sb.AppendLine("BT /F2 12 Tf 0.07 0.09 0.15 rg 160 440 Td (" + cleanCustomer + ") Tj ET");

        sb.AppendLine("BT /F1 11 Tf 0.3 0.35 0.4 rg 60 410 Td (ORDER CODE:) Tj ET");
        sb.AppendLine("BT /F2 12 Tf 0.07 0.09 0.15 rg 160 410 Td (#" + orderCode + ") Tj ET");

        // QR Verification Section
        sb.AppendLine("0.85 0.88 0.92 RG 0.75 w 60 380 m 535 380 l S");

        sb.AppendLine("BT /F1 10 Tf 0.3 0.35 0.4 rg 60 355 Td (HMAC-SHA256 SECURITY TOKEN / VERIFICATION SIGNATURE:) Tj ET");
        sb.AppendLine("BT /F2 9 Tf 0.15 0.2 0.3 rg 60 335 Td (" + cleanQr + ") Tj ET");

        // Footer instructions
        sb.AppendLine("BT /F2 8.5 Tf 0.45 0.5 0.55 rg 60 215 Td (Please present this ticket or the QR code in the TickeX mobile app at the entrance gate.) Tj ET");
        sb.AppendLine("BT /F2 8.5 Tf 0.45 0.5 0.55 rg 60 198 Td (Valid for a single admission. Duplicate scans will be rejected by turnstile security.) Tj ET");

        sb.AppendLine("Q");

        var contentStreamBytes = Encoding.ASCII.GetBytes(sb.ToString());

        // Assemble 100% compliant PDF 1.4 document
        using var ms = new MemoryStream();
        var offsets = new List<long>();

        void Write(string s) => ms.Write(Encoding.ASCII.GetBytes(s));

        Write("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

        // Object 1: Catalog
        offsets.Add(ms.Position);
        Write("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

        // Object 2: Pages
        offsets.Add(ms.Position);
        Write("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

        // Object 3: Page (A4 595.28 x 841.89)
        offsets.Add(ms.Position);
        Write("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n");

        // Object 4: Font Bold (Helvetica-Bold)
        offsets.Add(ms.Position);
        Write("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n");

        // Object 5: Font Regular (Helvetica)
        offsets.Add(ms.Position);
        Write("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

        // Object 6: Contents Stream
        offsets.Add(ms.Position);
        Write($"6 0 obj\n<< /Length {contentStreamBytes.Length} >>\nstream\n");
        ms.Write(contentStreamBytes, 0, contentStreamBytes.Length);
        Write("\nendstream\nendobj\n");

        // xref Table
        var xrefOffset = ms.Position;
        Write($"xref\n0 {offsets.Count + 1}\n0000000000 65535 f \n");
        foreach (var offset in offsets)
        {
            Write($"{offset:D10} 00000 n \n");
        }

        // Trailer
        Write($"trailer\n<< /Size {offsets.Count + 1} /Root 1 0 R >>\nstartxref\n{xrefOffset}\n%%EOF\n");

        return ms.ToArray();
    }

    private static string EscapePdfText(string text)
    {
        return text
            .Replace("\\", "\\\\")
            .Replace("(", "\\(")
            .Replace(")", "\\)");
    }

    private static string RemoveDiacritics(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var normalizedString = text.Normalize(NormalizationForm.FormD);
        var stringBuilder = new StringBuilder();

        foreach (var c in normalizedString)
        {
            var unicodeCategory = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c);
            if (unicodeCategory != System.Globalization.UnicodeCategory.NonSpacingMark)
            {
                stringBuilder.Append(c);
            }
        }

        return stringBuilder.ToString().Normalize(NormalizationForm.FormC)
            .Replace('đ', 'd').Replace('Đ', 'D');
    }
}

