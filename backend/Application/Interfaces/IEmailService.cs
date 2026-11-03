namespace TickeX.Application.Interfaces;

public interface IEmailService
{
    Task SendEmailAsync(string to, string subject, string body);
    Task SendEmailWithAttachmentAsync(string to, string subject, string bodyHtml, byte[] attachmentBytes, string attachmentFileName, string contentType = "application/pdf");
}
