using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TickeX.Application.Tickets.Commands;
using TickeX.Application.Tickets.Queries;
using TickeX.Application.Interfaces;
using TickeX.WebApi.Configuration;
using TickeX.WebApi.Filters;

namespace TickeX.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("BookingPolicy")]
public class TicketsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ICheckInOperations _checkInOperations;
    private readonly ICustomerTicketReadModel _customerTicketReadModel;

    public TicketsController(IMediator mediator, ICheckInOperations checkInOperations, ICustomerTicketReadModel customerTicketReadModel)
    {
        _mediator = mediator;
        _checkInOperations = checkInOperations;
        _customerTicketReadModel = customerTicketReadModel;
    }

    [HttpGet("my-tickets")]
    public async Task<IActionResult> GetMyTickets([FromQuery] int? page = null, [FromQuery] int? pageSize = null, [FromQuery] string? status = null, CancellationToken cancellationToken = default)
    {
        var effectivePage = page ?? 1;
        var effectivePageSize = pageSize ?? 10;
        if (effectivePage < 1 || effectivePageSize is < 1 or > 50 || ((long)effectivePage - 1) * effectivePageSize > int.MaxValue)
        {
            return this.PaginationOutOfRange();
        }
        var userId = this.GetAuthenticatedUserId();
        if (userId is null)
        {
            return this.UnauthorizedProblem("User is not authenticated");
        }

        var result = await _mediator.Send(new GetMyTicketsQuery(userId.Value, page, pageSize, status), cancellationToken);
        return Ok(new { success = true, data = result });
    }

    [HttpGet("my-tickets/cursor")]
    public async Task<IActionResult> GetMyTicketsCursor([FromQuery] string? cursor = null, [FromQuery] int limit = 10, [FromQuery] string? status = null, CancellationToken cancellationToken = default)
    {
        if (limit is < 1 or > 50)
        {
            return this.PaginationOutOfRange("limit phải nằm trong khoảng 1–50.");
        }

        var userId = this.GetAuthenticatedUserId();
        if (userId is null)
        {
            return this.UnauthorizedProblem("User is not authenticated");
        }

        try
        {
            var result = await _customerTicketReadModel.GetForUserCursorAsync(userId.Value, cursor, limit, status, cancellationToken);
            return Ok(new { success = true, data = result });
        }
        catch (ArgumentException ex) when (cursor is not null)
        {
            return this.BadRequestProblem("INVALID_CURSOR", ex.Message);
        }
    }

    public record RefundRequest(string? Reason);

    [HttpPost("{id}/refund")]
    [Idempotent]
    public async Task<IActionResult> RefundTicket(Guid id, [FromBody] RefundRequest? request, CancellationToken cancellationToken = default)
    {
        var userId = this.GetAuthenticatedUserId();
        if (userId is null)
        {
            return this.UnauthorizedProblem();
        }

        var command = new RefundTicketCommand(
            id,
            userId.Value,
            request?.Reason ?? "Customer Request",
            User.FindFirstValue(ClaimTypes.Email) ?? "",
            HttpContext.Connection.RemoteIpAddress?.ToString());
        var result = await _mediator.Send(command, cancellationToken);

        if (!result.Success)
        {
            var statusCode = result.Code switch
            {
                "REFUND_LOCK_UNAVAILABLE" or "REFUND_LOCK_LOST" => StatusCodes.Status503ServiceUnavailable,
                "REFUND_CONCURRENCY_CONFLICT" or "REFUND_DESTINATION_REQUIRED" => StatusCodes.Status409Conflict,
                "REFUND_TICKET_NOT_FOUND" or "REFUND_EVENT_NOT_FOUND" => StatusCodes.Status404NotFound,
                "REFUND_FORBIDDEN" => StatusCodes.Status403Forbidden,
                "REFUND_TICKET_USED" or "REFUND_ALREADY_CANCELLED" or "REFUND_TICKET_NOT_PAID" or "REFUND_CUTOFF_EXPIRED" => StatusCodes.Status409Conflict,
                _ => StatusCodes.Status400BadRequest
            };

            return this.ProblemDetails(statusCode, result.Code, result.Message, MapErrorCodeToTitle(result.Code));
        }

        return Ok(new { success = true, code = result.Code, message = result.Message, data = new { refundAmount = result.RefundAmount } });
    }

    [HttpGet("{id:guid}/dynamic-qr")]
    public async Task<IActionResult> GetDynamicQr(Guid id, CancellationToken cancellationToken = default)
    {
        var userId = this.GetAuthenticatedUserId();
        if (userId is null)
        {
            return this.UnauthorizedProblem();
        }

        var isAdmin = User.IsInRole("Admin");
        var result = await _mediator.Send(new GetDynamicQrQuery(id, userId.Value, isAdmin), cancellationToken);

        if (!result.Success)
        {
            var status = result.ErrorCode switch
            {
                "TICKET_NOT_FOUND" => StatusCodes.Status404NotFound,
                "FORBIDDEN" => StatusCodes.Status403Forbidden,
                _ => StatusCodes.Status400BadRequest
            };

            return this.ProblemDetails(status, result.ErrorCode, result.Message, "Get Dynamic QR Failed");
        }

        return Ok(new { success = true, data = result.Data });
    }

    public record TransferTicketRequest(string RecipientEmail, string? Note = null);

    [HttpPost("{id:guid}/transfer")]
    [Authorize]
    [EnableRateLimiting("BookingPolicy")]
    public async Task<IActionResult> TransferTicket(Guid id, [FromBody] TransferTicketRequest request, CancellationToken cancellationToken = default)
    {
        var userId = this.GetAuthenticatedUserId();
        if (userId is null)
        {
            return this.UnauthorizedProblem();
        }

        if (request == null || string.IsNullOrWhiteSpace(request.RecipientEmail))
        {
            return this.BadRequestProblem("RECIPIENT_EMAIL_EMPTY", "Vui lòng nhập email người nhận.");
        }

        var command = new TransferTicketCommand(id, userId.Value, request.RecipientEmail, request.Note);
        var result = await _mediator.Send(command, cancellationToken);

        if (!result.Success)
        {
            var status = result.Code switch
            {
                "TICKET_NOT_FOUND" => StatusCodes.Status404NotFound,
                "FORBIDDEN" => StatusCodes.Status403Forbidden,
                "LOCK_CONFLICT" or "CONCURRENCY_CONFLICT" => StatusCodes.Status409Conflict,
                "LOCK_UNAVAILABLE" => StatusCodes.Status503ServiceUnavailable,
                "RECIPIENT_NOT_FOUND" => StatusCodes.Status404NotFound,
                _ => StatusCodes.Status400BadRequest
            };

            return this.ProblemDetails(status, result.Code, result.Message, "Transfer Ticket Failed");
        }

        return Ok(new { success = true, code = "TRANSFER_SUCCESS", message = result.Message, data = new { transferId = result.TransferId } });
    }

    public record CheckInRequest(string QrToken);

    [HttpPost("check-in")]
    [Idempotent]
    [Authorize(Roles = "Admin,Staff")]
    [EnableRateLimiting("BookingPolicy")]
    public async Task<IActionResult> CheckIn([FromBody] CheckInRequest request, CancellationToken cancellationToken = default)
    {
        var staffUserId = this.GetAuthenticatedUserId();
        if (staffUserId is null)
        {
            return this.UnauthorizedProblem("Không xác định được danh tính nhân viên từ token.");
        }

        var callerRole = User.FindFirstValue(ClaimTypes.Role) ?? "Staff";
        var staffEmail = User.FindFirstValue(ClaimTypes.Email) ?? "staff@tickex.com";
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        var command = new CheckInTicketCommand(request.QrToken, staffUserId.Value, callerRole, staffEmail, ipAddress);
        var result = await _checkInOperations.CheckInAsync(command, cancellationToken);

        if (!result.Success)
        {
            return this.ProblemDetails(result.StatusCode, result.Code, result.Message, MapErrorCodeToTitle(result.Code));
        }

        return Ok(new { success = true, message = result.Message, data = result.Ticket });
    }

    [HttpGet("events/{eventId:guid}/offline-manifest")]
    [Authorize(Roles = "Admin,Staff,Organizer")]
    public async Task<IActionResult> GetOfflineManifest(Guid eventId, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetEventOfflineManifestQuery(eventId), cancellationToken);
        return Ok(new { success = true, data = result });
    }

    [HttpPost("sync-offline-checkins")]
    [Authorize(Roles = "Admin,Staff,Organizer")]
    public async Task<IActionResult> SyncOfflineCheckIns([FromBody] SyncOfflineCheckInsCommand command, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(new { success = true, message = $"Đã đồng bộ {result.Successful}/{result.TotalProcessed} lượt quét ngoại tuyến thành công.", data = result });
    }

    private static string MapErrorCodeToTitle(string? errorCode) => errorCode switch
    {
        "REFUND_LOCK_UNAVAILABLE" or "REFUND_LOCK_LOST" or "CHECKIN_LOCK_UNAVAILABLE" or "CHECKIN_LOCK_LOST" => "Service Unavailable",
        "REFUND_CONCURRENCY_CONFLICT" or "CHECKIN_CONCURRENCY_CONFLICT" => "Concurrency Conflict",
        "REFUND_DESTINATION_REQUIRED" => "Refund Destination Required",
        "REFUND_TICKET_NOT_FOUND" or "REFUND_EVENT_NOT_FOUND" or "CHECKIN_TICKET_NOT_FOUND" => "Resource Not Found",
        "REFUND_FORBIDDEN" or "CHECKIN_FORBIDDEN" => "Forbidden",
        "REFUND_TICKET_USED" or "REFUND_ALREADY_CANCELLED" or "REFUND_TICKET_NOT_PAID" or "REFUND_CUTOFF_EXPIRED" => "Refund Policy Conflict",
        "CHECKIN_ALREADY_USED" or "CHECKIN_TICKET_NOT_PAID" or "CHECKIN_EVENT_NOT_ACTIVE" => "Check-In Conflict",
        "CHECKIN_INVALID_QR" => "Invalid QR Token",
        _ => "Ticket Operation Failed"
    };
}
