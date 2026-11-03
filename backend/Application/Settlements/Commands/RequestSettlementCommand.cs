namespace TickeX.Application.Settlements.Commands;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;

public record RequestSettlementCommand(
    Guid EventId,
    Guid OrganizerId,
    string BankName,
    string BankAccountNumber,
    string AccountHolder
) : IRequest<RequestSettlementResult>;

public record RequestSettlementResult(
    bool Success,
    string Message,
    Guid? SettlementId = null,
    string? Code = null,
    decimal? NetPayout = null
);

public class RequestSettlementCommandHandler : IRequestHandler<RequestSettlementCommand, RequestSettlementResult>
{
    private readonly IApplicationDbContext _context;

    public RequestSettlementCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<RequestSettlementResult> Handle(RequestSettlementCommand request, CancellationToken cancellationToken)
    {
        var ev = await _context.Events.AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == request.EventId, cancellationToken);

        if (ev == null)
            return new RequestSettlementResult(false, "Không tìm thấy thông tin sự kiện.", Code: "EVENT_NOT_FOUND");

        if (ev.OrganizerId != request.OrganizerId)
            return new RequestSettlementResult(false, "Bạn không có quyền yêu cầu quyết toán cho sự kiện này.", Code: "FORBIDDEN");

        // Prevent duplicate active settlement
        var existingActive = await _context.Settlements.AsNoTracking()
            .AnyAsync(s => s.EventId == request.EventId && (s.Status == SettlementStatus.Pending || s.Status == SettlementStatus.Approved), cancellationToken);

        if (existingActive)
            return new RequestSettlementResult(false, "Sự kiện này đã có yêu cầu quyết toán đang được xử lý.", Code: "SETTLEMENT_ALREADY_PENDING");

        // Fetch paid & checked-in tickets
        var paidTickets = await _context.Tickets.AsNoTracking()
            .Where(t => t.EventId == request.EventId && (t.Status == TicketStatus.Paid || t.Status == TicketStatus.Used))
            .Select(t => t.Price)
            .ToListAsync(cancellationToken);

        var grossRevenue = paidTickets.Sum();
        if (grossRevenue <= 0)
            return new RequestSettlementResult(false, "Sự kiện chưa phát sinh doanh thu bán vé hợp lệ.", Code: "NO_VALID_REVENUE");

        // Fetch refunded tickets
        var refundedTickets = await _context.Tickets.AsNoTracking()
            .Where(t => t.EventId == request.EventId && (t.Status == TicketStatus.Cancelled || t.Status == TicketStatus.RefundPending))
            .Select(t => t.RefundAmount ?? t.Price)
            .ToListAsync(cancellationToken);

        var refundDeduction = refundedTickets.Sum();
        const decimal commissionRate = 0.05m; // 5% platform commission

        var settlement = new Settlement(
            request.EventId,
            request.OrganizerId,
            grossRevenue,
            commissionRate,
            refundDeduction,
            request.BankName,
            request.BankAccountNumber,
            request.AccountHolder
        );

        _context.Settlements.Add(settlement);
        await _context.SaveChangesAsync(cancellationToken);

        return new RequestSettlementResult(
            true,
            "Yêu cầu quyết toán doanh thu đã được gửi tới Ban Quản Trị TickeX.",
            SettlementId: settlement.Id,
            NetPayout: settlement.NetPayout
        );
    }
}
