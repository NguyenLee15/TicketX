using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration configuration, IHostEnvironment environment, ILogger<EmailService> logger)
    {
        _configuration = configuration;
        _environment = environment;
        _logger = logger;
    }

    public Task SendEmailAsync(string to, string subject, string body)
        => SendEmailWithAttachmentAsync(to, subject, body, Array.Empty<byte>(), string.Empty);

    public async Task SendEmailWithAttachmentAsync(
        string to, 
        string subject, 
        string bodyHtml, 
        byte[] attachmentBytes, 
        string attachmentFileName, 
        string contentType = "application/pdf")
    {
        var smtpServer = _configuration["Smtp:Server"];
        var smtpPort = int.Parse(_configuration["Smtp:Port"] ?? "587");
        var smtpUser = _configuration["Smtp:Username"];
        var smtpPass = _configuration["Smtp:Password"];
        var fromEmail = _configuration["Smtp:FromEmail"] ?? "noreply@tickex.com";

        if (string.IsNullOrEmpty(smtpServer) || string.IsNullOrEmpty(smtpUser))
        {
            if (_environment.IsDevelopment())
            {
                _logger.LogInformation("SMTP is not configured; simulated email delivery to {To} with subject '{Subject}' and attachment '{AttachmentName}' ({Bytes} bytes).",
                    to, subject, attachmentFileName, attachmentBytes?.Length ?? 0);
                return;
            }
            throw new InvalidOperationException("SMTP is not configured.");
        }

        using var client = new SmtpClient(smtpServer, smtpPort)
        {
            Credentials = new NetworkCredential(smtpUser, smtpPass),
            EnableSsl = true
        };

        var mailMessage = new MailMessage
        {
            From = new MailAddress(fromEmail),
            Subject = subject,
            Body = bodyHtml,
            IsBodyHtml = true
        };

        mailMessage.To.Add(to);

        if (attachmentBytes != null && attachmentBytes.Length > 0 && !string.IsNullOrWhiteSpace(attachmentFileName))
        {
            var stream = new MemoryStream(attachmentBytes);
            mailMessage.Attachments.Add(new Attachment(stream, attachmentFileName, contentType));
        }

        await client.SendMailAsync(mailMessage);
    }
}
