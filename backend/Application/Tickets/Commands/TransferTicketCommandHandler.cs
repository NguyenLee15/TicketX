namespace TickeX.Application.Tickets.Commands;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;

public class TransferTicketCommandHandler : IRequestHandler<TransferTicketCommand, TransferTicketResult>
{
    private readonly IApplicationDbContext _context;
    private readonly ITicketSecurityService _ticketSecurityService;
    private readonly IEmailService? _emailService;
    private readonly ITimePolicy _time;
    private readonly IDistributedLockService? _lockService;

    public TransferTicketCommandHandler(
        IApplicationDbContext context,
        ITicketSecurityService ticketSecurityService,
        ITimePolicy? time = null,
        IDistributedLockService? lockService = null,
        IEmailService? emailService = null)
    {
        _context = context;
        _ticketSecurityService = ticketSecurityService;
        _time = time ?? new UtcTimePolicy();
        _lockService = lockService;
        _emailService = emailService;
    }

    public async Task<TransferTicketResult> Handle(TransferTicketCommand request, CancellationToken cancellationToken)
    {
        if (request.TicketId == Guid.Empty)
        {
            return new TransferTicketResult(false, "Mã vé không hợp lệ.", "INVALID_TICKET_ID");
        }

        if (string.IsNullOrWhiteSpace(request.RecipientEmail))
        {
            return new TransferTicketResult(false, "Vui lòng nhập email người nhận.", "RECIPIENT_EMAIL_EMPTY");
        }

        var normalizedEmail = request.RecipientEmail.Trim().ToLowerInvariant();

        IDistributedLockLease? lease = null;
        if (_lockService is not null)
        {
            try
            {
                lease = await _lockService.AcquireLockAsync($"lock:ticket:{request.TicketId}", TimeSpan.FromSeconds(10), cancellationToken);
            }
            catch (Exception)
            {
                return new TransferTicketResult(false, "Hệ thống đang bận. Vui lòng thử lại sau.", "LOCK_UNAVAILABLE");
            }

            if (lease is null)
            {
                return new TransferTicketResult(false, "Vé đang được xử lý ở một giao dịch khác. Vui lòng thử lại.", "LOCK_CONFLICT");
            }
        }

        try
        {
            await using (lease)
            {
                var ticket = await _context.Tickets
                    .Include(t => t.Event)
                    .Include(t => t.Seat)
                    .Include(t => t.User)
                    .FirstOrDefaultAsync(t => t.Id == request.TicketId, cancellationToken);

                if (ticket == null)
                {
                    return new TransferTicketResult(false, "Không tìm thấy vé trong hệ thống.", "TICKET_NOT_FOUND");
                }

                if (ticket.UserId != request.SenderUserId)
                {
                    return new TransferTicketResult(false, "Bạn không phải chủ sở hữu hợp pháp của vé này.", "FORBIDDEN");
                }

                if (ticket.Status != TicketStatus.Paid)
                {
                    return new TransferTicketResult(false, $"Chỉ có vé ở trạng thái đã thanh toán mới có thể chuyển nhượng (Trạng thái hiện tại: {ticket.Status}).", "INVALID_TICKET_STATUS");
                }

                if (ticket.Event == null)
                {
                    return new TransferTicketResult(false, "Không tìm thấy thông tin sự kiện của vé.", "EVENT_NOT_FOUND");
                }

                if (ticket.Event.Date <= _time.UtcNow)
                {
                    return new TransferTicketResult(false, "Sự kiện đã diễn ra hoặc đang diễn ra, không thể chuyển nhượng vé.", "EVENT_ALREADY_STARTED");
                }

                var recipientUser = await _context.Users
                    .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken);

                if (recipientUser == null)
                {
                    return new TransferTicketResult(false, $"Không tìm thấy tài khoản với email '{normalizedEmail}'. Người nhận cần tạo tài khoản trên TickeX trước khi nhận vé.", "RECIPIENT_NOT_FOUND");
                }

                if (recipientUser.Id == request.SenderUserId)
                {
                    return new TransferTicketResult(false, "Bạn không thể chuyển nhượng vé cho chính mình.", "SELF_TRANSFER_NOT_ALLOWED");
                }

                // Generate new QR token with fresh expiration
                var expiresAt = ticket.Event.EndDate.AddHours(6);
                var newQrToken = _ticketSecurityService.GenerateSignedQrToken(
                    ticket.Id,
                    ticket.EventId,
                    ticket.OrderCode,
                    expiresAt
                );

                // Create audit record
                var transfer = new TicketTransfer(ticket.Id, request.SenderUserId, normalizedEmail, request.Note);
                transfer.Complete(recipientUser.Id);
                _context.TicketTransfers.Add(transfer);

                // Transfer ticket ownership and update signed QR token
                ticket.TransferTo(recipientUser.Id, newQrToken);

                await _context.SaveChangesAsync(cancellationToken);

                // Fire-and-forget notification email
                if (_emailService != null)
                {
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            var senderName = ticket.User?.Name ?? "Người dùng TickeX";
                            var subject = $"[TickeX] Bạn vừa nhận được vé sự kiện {ticket.Event.Title}!";
                            var body = $@"
                                <div style=""font-family: sans-serif; line-height: 1.6;"">
                                    <h2>Chúc mừng bạn đã nhận được vé từ {senderName}!</h2>
                                    <p>Thông tin vé:</p>
                                    <ul>
                                        <li><strong>Sự kiện:</strong> {ticket.Event.Title}</li>
                                        <li><strong>Vị trí ghế:</strong> {ticket.Seat?.Row}{ticket.Seat?.Number}</li>
                                        <li><strong>Thời gian:</strong> {ticket.Event.Date:dd/MM/yyyy HH:mm}</li>
                                        <li><strong>Địa điểm:</strong> {ticket.Event.Location}</li>
                                    </ul>
                                    <p>Vé đã được thêm vào mục <strong>Vé Của Tôi</strong> trong tài khoản TickeX của bạn ({normalizedEmail}).</p>
                                </div>";

                            await _emailService.SendEmailAsync(normalizedEmail, subject, body);
                        }
                        catch
                        {
                            // Ignore transient email failure to prevent impacting transfer result
                        }
                    }, CancellationToken.None);
                }

                return new TransferTicketResult(
                    true,
                    $"Chuyển nhượng vé cho tài khoản '{normalizedEmail}' thành công! Vé và mã QR cũ đã được vô hiệu hóa an toàn.",
                    TransferId: transfer.Id
                );
            }
        }
        catch (DbUpdateConcurrencyException)
        {
            return new TransferTicketResult(false, "Xung đột dữ liệu khi chuyển nhượng vé. Vui lòng thử lại.", "CONCURRENCY_CONFLICT");
        }
    }
}
