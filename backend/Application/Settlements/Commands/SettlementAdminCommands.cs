namespace TickeX.Application.Settlements.Commands;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;

public record ApproveSettlementCommand(
    Guid SettlementId,
    Guid AdminUserId,
    string? AdminNote = null
) : IRequest<SettlementOperationResult>;

public record CompleteSettlementCommand(
    Guid SettlementId,
    Guid AdminUserId,
    string? BankTransactionRef = null,
    string? AdminNote = null
) : IRequest<SettlementOperationResult>;

public record RejectSettlementCommand(
    Guid SettlementId,
    Guid AdminUserId,
    string Reason
) : IRequest<SettlementOperationResult>;

public record SettlementOperationResult(
    bool Success,
    string Message,
    string? Code = null
);

public class SettlementAdminCommandHandler :
    IRequestHandler<ApproveSettlementCommand, SettlementOperationResult>,
    IRequestHandler<CompleteSettlementCommand, SettlementOperationResult>,
    IRequestHandler<RejectSettlementCommand, SettlementOperationResult>
{
    private readonly IApplicationDbContext _context;

    public SettlementAdminCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<SettlementOperationResult> Handle(ApproveSettlementCommand request, CancellationToken cancellationToken)
    {
        var settlement = await _context.Settlements
            .FirstOrDefaultAsync(s => s.Id == request.SettlementId, cancellationToken);

        if (settlement == null)
            return new SettlementOperationResult(false, "Không tìm thấy thông tin quyết toán.", Code: "SETTLEMENT_NOT_FOUND");

        try
        {
            settlement.Approve(request.AdminNote);
            await _context.SaveChangesAsync(cancellationToken);
            return new SettlementOperationResult(true, "Đã phê duyệt yêu cầu quyết toán.");
        }
        catch (InvalidOperationException ex)
        {
            return new SettlementOperationResult(false, ex.Message, Code: "INVALID_STATUS");
        }
    }

    public async Task<SettlementOperationResult> Handle(CompleteSettlementCommand request, CancellationToken cancellationToken)
    {
        var settlement = await _context.Settlements
            .FirstOrDefaultAsync(s => s.Id == request.SettlementId, cancellationToken);

        if (settlement == null)
            return new SettlementOperationResult(false, "Không tìm thấy thông tin quyết toán.", Code: "SETTLEMENT_NOT_FOUND");

        try
        {
            var note = string.IsNullOrWhiteSpace(request.BankTransactionRef)
                ? request.AdminNote
                : $"[Mã GD: {request.BankTransactionRef}] {request.AdminNote}".Trim();

            settlement.Complete(note);
            await _context.SaveChangesAsync(cancellationToken);
            return new SettlementOperationResult(true, "Đã hoàn tất chuyển khoản quyết toán.");
        }
        catch (InvalidOperationException ex)
        {
            return new SettlementOperationResult(false, ex.Message, Code: "INVALID_STATUS");
        }
    }

    public async Task<SettlementOperationResult> Handle(RejectSettlementCommand request, CancellationToken cancellationToken)
    {
        var settlement = await _context.Settlements
            .FirstOrDefaultAsync(s => s.Id == request.SettlementId, cancellationToken);

        if (settlement == null)
            return new SettlementOperationResult(false, "Không tìm thấy thông tin quyết toán.", Code: "SETTLEMENT_NOT_FOUND");

        try
        {
            settlement.Reject(request.Reason);
            await _context.SaveChangesAsync(cancellationToken);
            return new SettlementOperationResult(true, "Đã từ chối yêu cầu quyết toán.");
        }
        catch (Exception ex)
        {
            return new SettlementOperationResult(false, ex.Message, Code: "REJECT_FAILED");
        }
    }
}
