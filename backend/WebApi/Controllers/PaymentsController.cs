using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TickeX.Application.Interfaces;
using TickeX.WebApi.Configuration;
using TickeX.WebApi.Filters;

namespace TickeX.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("BookingPolicy")]
public class PaymentsController : ControllerBase
{
    private readonly ICustomerCheckoutOperations _checkout;
    public PaymentsController(ICustomerCheckoutOperations checkout) => _checkout = checkout;

    public record CreatePaymentLinkRequest(Guid TicketId, string? CouponCode = null);

    [Authorize]
    [HttpGet("status/{orderCode:long}")]
    public async Task<IActionResult> GetStatus(long orderCode, CancellationToken cancellationToken)
    {
        var userId = this.GetAuthenticatedUserId();
        if (userId is null) return this.UnauthorizedProblem();
        return Respond(await _checkout.GetStatusAsync(orderCode, userId.Value, cancellationToken), notFound: true);
    }

    [Authorize]
    [Idempotent]
    [HttpPost("create-link")]
    public async Task<IActionResult> CreatePaymentLink([FromBody] CreatePaymentLinkRequest request, CancellationToken cancellationToken)
    {
        var userId = this.GetAuthenticatedUserId();
        if (userId is null) return this.UnauthorizedProblem();
        return Respond(await _checkout.CreatePaymentLinkAsync(request.TicketId, userId.Value, request.CouponCode, cancellationToken));
    }

    [AllowAnonymous]
    [RequestSizeLimit(65_536)]
    [HttpPost("webhook")]
    public async Task<IActionResult> Webhook(CancellationToken cancellationToken)
    {
        if (Request.ContentLength is > 65_536)
            return this.ProblemDetails(StatusCodes.Status413PayloadTooLarge, "PAYMENT_WEBHOOK_TOO_LARGE", "Dữ liệu thanh toán vượt quá kích thước cho phép.");

        using var reader = new StreamReader(Request.Body, System.Text.Encoding.UTF8);
        var buffer = new char[65_537];
        var read = await reader.ReadBlockAsync(buffer, 0, buffer.Length);
        if (read > 65_536 || !reader.EndOfStream)
        {
            return this.ProblemDetails(StatusCodes.Status413PayloadTooLarge, "PAYMENT_WEBHOOK_TOO_LARGE", "Dữ liệu thanh toán vượt quá kích thước cho phép.");
        }
        var body = new string(buffer, 0, read);
        var signature = Request.Headers["x-payos-signature"].FirstOrDefault()
            ?? Request.Headers["X-PayOS-Signature"].FirstOrDefault() ?? string.Empty;
        return Respond(await _checkout.ProcessWebhookAsync(body, signature, cancellationToken));
    }

    [Authorize]
    [HttpPost("simulate-success/{orderCode:long}")]
    public async Task<IActionResult> SimulateSuccess(long orderCode, CancellationToken cancellationToken)
    {
        var userId = this.GetAuthenticatedUserId();
        if (userId is null) return this.UnauthorizedProblem();
        var result = await _checkout.SimulateSuccessAsync(orderCode, userId.Value, cancellationToken);
        return result.Code == "PAYMENT_SIMULATION_DISABLED" 
            ? this.NotFoundProblem("PAYMENT_SIMULATION_DISABLED", "Môi trường mô phỏng thanh toán đã bị vô hiệu hóa.")
            : Respond(result, notFound: true);
    }

    private IActionResult Respond(CustomerCheckoutResult result, bool notFound = false)
    {
        if (result.Success)
            return Ok(new { success = true, code = result.Code, message = result.Message, data = new
            {
                orderCode = result.OrderCode?.ToString(),
                amount = result.Amount,
                checkoutUrl = result.CheckoutUrl,
                status = result.Status,
                ticketId = result.TicketId,
                refundStatus = result.RefundStatus,
                qrCode = result.QrCode,
                accountNumber = result.AccountNumber,
                accountName = result.AccountName,
                bin = result.Bin,
                description = result.Description
            }});
        if (result.Code == "PAYMENT_NOT_FOUND")
            return this.NotFoundProblem(result.Code, result.Message);
        if (result.Code == "PAYMENT_FORBIDDEN")
            return this.ForbiddenProblem(result.Code, result.Message);
        if (result.Code == "PAYMENT_PROVIDER_UNAVAILABLE")
            return this.ServiceUnavailableProblem(result.Code, result.Message);
        return this.BadRequestProblem(result.Code, result.Message);
    }
}
