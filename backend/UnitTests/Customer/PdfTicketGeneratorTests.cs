using FluentAssertions;
using System.Text;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Customer;

public class PdfTicketGeneratorTests
{
    [Fact]
    public void GenerateTicketPdf_ShouldReturnValidPdfDocument()
    {
        var generator = new PdfTicketGenerator();

        var pdfBytes = generator.GenerateTicketPdf(
            eventTitle: "Ha Anh Tuan Live Concert - Chan Troi Ruc Ro",
            eventDate: DateTime.UtcNow.AddDays(14),
            venueName: "San Van Dong My Dinh",
            location: "Ha Noi, Viet Nam",
            seatRow: "A",
            seatNumber: 15,
            seatTier: "VIP",
            price: 1500000m,
            orderCode: 987654321012L,
            qrCodeSignature: "SECURE_HMAC_SIGNATURE_TOKEN_XYZ_123456",
            customerName: "Nguyen Van A");

        pdfBytes.Should().NotBeNull();
        pdfBytes.Length.Should().BeGreaterThan(500);

        var header = Encoding.ASCII.GetString(pdfBytes[..8]);
        header.Should().StartWith("%PDF-1.4");

        var contentString = Encoding.ASCII.GetString(pdfBytes);
        contentString.Should().Contain("%%EOF");
        contentString.Should().Contain("TICKEX ELECTRONIC TICKET");
        contentString.Should().Contain("1,500,000 VND");
        contentString.Should().Contain("#987654321012");
    }
}

