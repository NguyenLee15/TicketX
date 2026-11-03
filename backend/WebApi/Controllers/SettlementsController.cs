namespace TickeX.WebApi.Controllers;

using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TickeX.Application.Settlements.Commands;
using TickeX.Application.Settlements.Queries;
using TickeX.Domain.Enums;
using TickeX.WebApi.Configuration;

[ApiController]
[Route("api/[controller]")]
public class SettlementsController : ControllerBase
{
    private readonly IMediator _mediator;

    public SettlementsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    public record RequestSettlementApiRequest(
        Guid EventId,
        string BankName,
        string BankAccountNumber,
        string? AccountHolder = null,
        string? BankAccountHolder = null
    );

    [HttpPost("request")]
    [Authorize(Roles = "Organizer,Admin")]
    public async Task<IActionResult> RequestSettlement([FromBody] RequestSettlementApiRequest request, CancellationToken cancellationToken)
    {
        var userId = this.GetAuthenticatedUserId();
        if (userId == null)
            return this.UnauthorizedProblem();

        if (request == null || request.EventId == Guid.Empty)
        {
            return this.BadRequestProblem("INVALID_REQUEST", "Thông tin yêu cầu quyết toán không hợp lệ.");
        }

        var holder = request.BankAccountHolder ?? request.AccountHolder ?? string.Empty;

        var command = new RequestSettlementCommand(
            request.EventId,
            userId.Value,
            request.BankName,
            request.BankAccountNumber,
            holder
        );

        var result = await _mediator.Send(command, cancellationToken);
        if (!result.Success)
        {
            var status = result.Code switch
            {
                "FORBIDDEN" => StatusCodes.Status403Forbidden,
                "EVENT_NOT_FOUND" => StatusCodes.Status404NotFound,
                "SETTLEMENT_ALREADY_PENDING" => StatusCodes.Status409Conflict,
                _ => StatusCodes.Status400BadRequest
            };

            return this.ProblemDetails(status, result.Code ?? "SETTLEMENT_ERROR", result.Message, "Settlement Request Failed");
        }

        return Ok(new
        {
            success = true,
            message = result.Message,
            data = new { settlementId = result.SettlementId, netPayout = result.NetPayout }
        });
    }

    [HttpGet]
    [Authorize(Roles = "Organizer,Admin")]
    public async Task<IActionResult> GetSettlements([FromQuery] SettlementStatus? status = null, CancellationToken cancellationToken = default)
    {
        var userId = this.GetAuthenticatedUserId();
        if (userId == null)
            return this.UnauthorizedProblem();

        var isAdmin = User.IsInRole("Admin");
        // Non-admin organizers can ONLY view their own settlements
        Guid? filterOrganizerId = isAdmin ? null : userId.Value;

        var list = await _mediator.Send(new GetSettlementsQuery(filterOrganizerId, status), cancellationToken);
        return Ok(new { success = true, data = list });
    }

    public record AdminNoteRequest(string? Note = null, string? AdminNote = null);
    public record CompleteSettlementApiRequest(string? BankTransactionRef = null, string? BankTransactionReference = null, string? Note = null, string? AdminNote = null);
    public record RejectSettlementApiRequest(string? Reason = null, string? Note = null, string? AdminNote = null);

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ApproveSettlement(Guid id, [FromBody] AdminNoteRequest? request, CancellationToken cancellationToken)
    {
        var adminId = this.GetAuthenticatedUserId();
        if (adminId == null)
            return this.UnauthorizedProblem();

        var note = request?.AdminNote ?? request?.Note;
        var result = await _mediator.Send(new ApproveSettlementCommand(id, adminId.Value, note), cancellationToken);
        if (!result.Success)
        {
            return this.BadRequestProblem(result.Code ?? "APPROVE_FAILED", result.Message);
        }

        return Ok(new { success = true, message = result.Message });
    }

    [HttpPost("{id:guid}/complete")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CompleteSettlement(Guid id, [FromBody] CompleteSettlementApiRequest? request, CancellationToken cancellationToken)
    {
        var adminId = this.GetAuthenticatedUserId();
        if (adminId == null)
            return this.UnauthorizedProblem();

        var txRef = request?.BankTransactionReference ?? request?.BankTransactionRef;
        var note = request?.AdminNote ?? request?.Note;
        var result = await _mediator.Send(new CompleteSettlementCommand(id, adminId.Value, txRef, note), cancellationToken);
        if (!result.Success)
        {
            return this.BadRequestProblem(result.Code ?? "COMPLETE_FAILED", result.Message);
        }

        return Ok(new { success = true, message = result.Message });
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RejectSettlement(Guid id, [FromBody] RejectSettlementApiRequest request, CancellationToken cancellationToken)
    {
        var adminId = this.GetAuthenticatedUserId();
        if (adminId == null)
            return this.UnauthorizedProblem();

        var reason = request?.Reason ?? request?.AdminNote ?? request?.Note;
        if (string.IsNullOrWhiteSpace(reason))
        {
            return this.BadRequestProblem("REASON_REQUIRED", "Lý do từ chối quyết toán không được để trống.");
        }

        var result = await _mediator.Send(new RejectSettlementCommand(id, adminId.Value, reason), cancellationToken);
        if (!result.Success)
        {
            return this.BadRequestProblem(result.Code ?? "REJECT_FAILED", result.Message);
        }

        return Ok(new { success = true, message = result.Message });
    }
}

