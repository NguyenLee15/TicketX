using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TickeX.Application.Seats.Commands;
using TickeX.WebApi.Configuration;
using TickeX.WebApi.Filters;

namespace TickeX.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("BookingPolicy")]
public class SeatsController : ControllerBase
{
    private readonly IMediator _mediator;

    public SeatsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    public record LockSeatRequest(Guid EventId, string Version, Guid? UserId = null);

    [Authorize]
    [Idempotent]
    [HttpPost("{id}/lock")]
    public async Task<IActionResult> LockSeat(Guid id, [FromBody] LockSeatRequest request, CancellationToken cancellationToken = default)
    {
        var currentUserId = this.GetAuthenticatedUserId();
        if (currentUserId is null)
        {
            return this.UnauthorizedProblem();
        }

        byte[] versionBytes;
        try
        {
            versionBytes = Convert.FromBase64String(request.Version);
        }
        catch (FormatException)
        {
            return BadRequest(new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Invalid Seat Version",
                status = StatusCodes.Status400BadRequest,
                success = false, 
                code = "INVALID_SEAT_VERSION", 
                message = "Invalid seat version token format. Valid Base64 string is required.",
                detail = "Invalid seat version token format. Valid Base64 string is required.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = "INVALID_SEAT_VERSION", message = "Invalid seat version token format. Valid Base64 string is required." }
            });
        }
        if (versionBytes.Length != 16)
        {
            return BadRequest(new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Invalid Seat Version",
                status = StatusCodes.Status400BadRequest,
                success = false, 
                code = "INVALID_SEAT_VERSION", 
                message = "Invalid seat version token length.",
                detail = "Invalid seat version token length.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = "INVALID_SEAT_VERSION", message = "Invalid seat version token length." }
            });
        }

        var command = new LockSeatCommand(request.EventId, id, currentUserId.Value, versionBytes);
        var lockResult = await _mediator.Send(command, cancellationToken);

        if (!lockResult.Success)
        {
            var statusCode = lockResult.Code switch
            {
                "RESERVATION_LOCK_UNAVAILABLE" or "RESERVATION_LOCK_LOST"
                    => StatusCodes.Status503ServiceUnavailable,
                "SEAT_VERSION_CONFLICT" or "SEAT_UNAVAILABLE" or "RESERVATION_LIMIT_REACHED" or "EVENT_NOT_ON_SALE"
                    => StatusCodes.Status409Conflict,
                _ => StatusCodes.Status400BadRequest
            };
            return StatusCode(statusCode, new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Seat Lock Failed",
                status = statusCode,
                success = false, 
                code = lockResult.Code, 
                message = lockResult.Message,
                detail = lockResult.Message,
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = lockResult.Code, message = lockResult.Message }
            });
        }

        return Created($"/api/tickets/{lockResult.TicketId}", new 
        { 
            success = true, 
            data = new 
            { 
                ticketId = lockResult.TicketId,
                expiresAt = lockResult.ExpiresAt,
                serverTime = lockResult.ServerTime
            }, 
            code = lockResult.Code,
            message = lockResult.Message
        });
    }

    public record SeatLockItem(Guid SeatId, string Version);
    public record BatchLockSeatsRequest(Guid EventId, List<SeatLockItem> Seats);

    [Authorize]
    [Idempotent]
    [HttpPost("batch-lock")]
    public async Task<IActionResult> BatchLockSeats([FromBody] BatchLockSeatsRequest request, CancellationToken cancellationToken = default)
    {
        var currentUserId = this.GetAuthenticatedUserId();
        if (currentUserId is null)
        {
            return this.UnauthorizedProblem();
        }

        if (request?.Seats == null || request.Seats.Count == 0)
        {
            return BadRequest(new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Invalid Request",
                status = StatusCodes.Status400BadRequest,
                success = false, 
                code = "INVALID_REQUEST", 
                message = "Danh sách ghế không được để trống.",
                detail = "Danh sách ghế không được để trống.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = "INVALID_REQUEST", message = "Danh sách ghế không được để trống." }
            });
        }

        var seatVersions = new Dictionary<Guid, byte[]>();
        var seatIds = new List<Guid>();

        foreach (var item in request.Seats)
        {
            byte[] versionBytes;
            try
            {
                versionBytes = Convert.FromBase64String(item.Version);
            }
            catch (FormatException)
            {
                return BadRequest(new 
                { 
                    type = "https://tools.ietf.org/html/rfc9457",
                    title = "Invalid Seat Version",
                    status = StatusCodes.Status400BadRequest,
                    success = false, 
                    code = "INVALID_SEAT_VERSION", 
                    message = $"Mã phiên bản ghế {item.SeatId} không đúng định dạng Base64.",
                    detail = $"Mã phiên bản ghế {item.SeatId} không đúng định dạng Base64.",
                    instance = HttpContext.Request.Path.Value,
                    traceId = HttpContext.TraceIdentifier,
                    error = new { code = "INVALID_SEAT_VERSION", message = $"Mã phiên bản ghế {item.SeatId} không đúng định dạng Base64." }
                });
            }

            if (versionBytes.Length != 16)
            {
                return BadRequest(new 
                { 
                    type = "https://tools.ietf.org/html/rfc9457",
                    title = "Invalid Seat Version",
                    status = StatusCodes.Status400BadRequest,
                    success = false, 
                    code = "INVALID_SEAT_VERSION", 
                    message = $"Mã phiên bản ghế {item.SeatId} phải có độ dài 16 bytes.",
                    detail = $"Mã phiên bản ghế {item.SeatId} phải có độ dài 16 bytes.",
                    instance = HttpContext.Request.Path.Value,
                    traceId = HttpContext.TraceIdentifier,
                    error = new { code = "INVALID_SEAT_VERSION", message = $"Mã phiên bản ghế {item.SeatId} phải có độ dài 16 bytes." }
                });
            }

            seatIds.Add(item.SeatId);
            seatVersions[item.SeatId] = versionBytes;
        }

        var command = new LockSeatsBatchCommand(request.EventId, seatIds, currentUserId.Value, seatVersions);
        var lockResult = await _mediator.Send(command, cancellationToken);

        if (!lockResult.Success)
        {
            var statusCode = lockResult.Code switch
            {
                "RESERVATION_LOCK_UNAVAILABLE" or "RESERVATION_LOCK_LOST"
                    => StatusCodes.Status503ServiceUnavailable,
                "SEAT_VERSION_CONFLICT" or "SEAT_UNAVAILABLE" or "RESERVATION_LIMIT_REACHED" or "EVENT_NOT_ON_SALE"
                    => StatusCodes.Status409Conflict,
                _ => StatusCodes.Status400BadRequest
            };
            return StatusCode(statusCode, new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Seats Batch Lock Failed",
                status = statusCode,
                success = false, 
                code = lockResult.Code, 
                message = lockResult.Message,
                detail = lockResult.Message,
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = lockResult.Code, message = lockResult.Message }
            });
        }

        return Created($"/api/tickets/{lockResult.TicketId}", new 
        { 
            success = true, 
            data = new 
            { 
                ticketId = lockResult.TicketId,
                ticketIds = lockResult.TicketIds,
                orderCode = lockResult.OrderCode,
                expiresAt = lockResult.ExpiresAt,
                serverTime = lockResult.ServerTime
            }, 
            code = lockResult.Code,
            message = lockResult.Message
        });
    }
}
