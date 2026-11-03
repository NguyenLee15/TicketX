namespace TickeX.WebApi.Controllers;

using MediatR;
using Microsoft.AspNetCore.Mvc;
using TickeX.Application.Coupons.Commands;
using TickeX.Application.Coupons.Queries;

[ApiController]
[Route("api/[controller]")]
public class CouponsController : ControllerBase
{
    private readonly IMediator _mediator;

    public CouponsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    public record ApplyCouponRequest(string Code, decimal OrderAmount, Guid? EventId = null);

    [HttpPost("apply")]
    public async Task<IActionResult> ApplyCoupon([FromBody] ApplyCouponRequest request, CancellationToken cancellationToken)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Code))
        {
            return BadRequest(new
            {
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Invalid Coupon Request",
                status = StatusCodes.Status400BadRequest,
                success = false,
                code = "INVALID_COUPON_CODE",
                message = "Mã giảm giá không được để trống.",
                detail = "Mã giảm giá không được để trống.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = "INVALID_COUPON_CODE", message = "Mã giảm giá không được để trống." }
            });
        }

        var command = new ApplyCouponCommand(request.Code, request.OrderAmount, request.EventId);
        var result = await _mediator.Send(command, cancellationToken);

        if (!result.Success)
        {
            var statusCode = result.ErrorCode switch
            {
                "COUPON_NOT_FOUND" => StatusCodes.Status404NotFound,
                _ => StatusCodes.Status400BadRequest
            };

            return StatusCode(statusCode, new
            {
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Coupon Application Failed",
                status = statusCode,
                success = false,
                code = result.ErrorCode ?? "COUPON_ERROR",
                message = result.Message,
                detail = result.Message,
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = result.ErrorCode ?? "COUPON_ERROR", message = result.Message }
            });
        }

        return Ok(new
        {
            success = true,
            data = new
            {
                code = result.Code,
                discountAmount = result.DiscountAmount,
                finalAmount = result.FinalAmount
            },
            message = result.Message
        });
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActiveCoupons([FromQuery] Guid? eventId, CancellationToken cancellationToken)
    {
        var coupons = await _mediator.Send(new GetActiveCouponsQuery(eventId), cancellationToken);
        return Ok(new
        {
            success = true,
            data = coupons
        });
    }
}

