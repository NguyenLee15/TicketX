namespace TickeX.Application.Tickets.Queries;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;

public record DynamicQrDto(
    Guid TicketId,
    string QrToken,
    int RemainingSeconds,
    int StepSeconds,
    DateTime ExpiresAt
);

public record GetDynamicQrQuery(Guid TicketId, Guid UserId, bool IsAdmin = false) : IRequest<DynamicQrResultDto>;

public record DynamicQrResultDto(
    bool Success,
    DynamicQrDto? Data = null,
    string? Message = null,
    string? ErrorCode = null
);

public class GetDynamicQrQueryHandler : IRequestHandler<GetDynamicQrQuery, DynamicQrResultDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ITotpService _totpService;

    public GetDynamicQrQueryHandler(IApplicationDbContext context, ITotpService totpService)
    {
        _context = context;
        _totpService = totpService;
    }

    public async Task<DynamicQrResultDto> Handle(GetDynamicQrQuery request, CancellationToken cancellationToken)
    {
        var ticket = await _context.Tickets.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == request.TicketId, cancellationToken);

        if (ticket == null)
            return new DynamicQrResultDto(false, null, "Không tìm thấy vé.", "TICKET_NOT_FOUND");

        if (!request.IsAdmin && ticket.UserId != request.UserId)
            return new DynamicQrResultDto(false, null, "Bạn không có quyền xem mã QR của vé này.", "FORBIDDEN");

        if (ticket.Status != TicketStatus.Paid)
            return new DynamicQrResultDto(false, null, "Vé chưa ở trạng thái hợp lệ để tạo mã QR.", "TICKET_NOT_PAID");

        var result = _totpService.GetDynamicQr(request.TicketId);
        var dto = new DynamicQrDto(
            request.TicketId,
            result.QrToken,
            result.RemainingSeconds,
            result.StepSeconds,
            result.ExpiresAt
        );

        return new DynamicQrResultDto(true, dto);
    }
}

