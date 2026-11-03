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
            return BadRequest(new
            {
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Invalid Settlement Request",
                status = StatusCodes.Status400BadRequest,
                success = false,
                code = "INVALID_REQUEST",
                message = "Thông tin yêu cầu quyết toán không hợp lệ.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier
            });
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

            return StatusCode(status, new
            {
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Settlement Request Failed",
                status,
                success = false,
                code = result.Code ?? "SETTLEMENT_ERROR",
                message = result.Message,
                detail = result.Message,
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier
            });
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
            return BadRequest(new
            {
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Approve Settlement Failed",
                status = StatusCodes.Status400BadRequest,
                success = false,
                code = result.Code ?? "APPROVE_FAILED",
                message = result.Message,
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier
            });
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
            return BadRequest(new
            {
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Complete Settlement Failed",
                status = StatusCodes.Status400BadRequest,
                success = false,
                code = result.Code ?? "COMPLETE_FAILED",
                message = result.Message,
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier
            });
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
            return BadRequest(new
            {
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Invalid Reject Request",
                status = StatusCodes.Status400BadRequest,
                success = false,
                code = "REASON_REQUIRED",
                message = "Lý do từ chối quyết toán không được để trống.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier
            });
        }

        var result = await _mediator.Send(new RejectSettlementCommand(id, adminId.Value, reason), cancellationToken);
        if (!result.Success)
        {
            return BadRequest(new
            {
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Reject Settlement Failed",
                status = StatusCodes.Status400BadRequest,
                success = false,
                code = result.Code ?? "REJECT_FAILED",
                message = result.Message,
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier
            });
        }

        return Ok(new { success = true, message = result.Message });
    }
}

