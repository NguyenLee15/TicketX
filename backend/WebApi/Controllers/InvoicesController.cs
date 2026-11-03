using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TickeX.Application.Invoices.Commands;
using TickeX.Application.Invoices.Queries;
using TickeX.WebApi.Configuration;

namespace TickeX.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InvoicesController : ControllerBase
{
    private readonly IMediator _mediator;

    public InvoicesController(IMediator mediator)
    {
        _mediator = mediator;
    }

    public record RequestInvoiceBody(
        long OrderCode,
        string TaxCode,
        string CompanyName,
        string CompanyAddress,
        string RecipientEmail,
        decimal? VatRate
    );

    [HttpPost("request")]
    [Authorize]
    public async Task<IActionResult> RequestInvoice([FromBody] RequestInvoiceBody body, CancellationToken cancellationToken)
    {
        var userId = this.GetAuthenticatedUserId();
        if (userId == null)
        {
            return this.UnauthorizedProblem("Không xác định được danh tính người dùng.");
        }

        var command = new CreateInvoiceRequestCommand(
            OrderCode: body.OrderCode,
            UserId: userId.Value,
            TaxCode: body.TaxCode,
            CompanyName: body.CompanyName,
            CompanyAddress: body.CompanyAddress,
            RecipientEmail: body.RecipientEmail,
            VatRate: body.VatRate
        );

        var result = await _mediator.Send(command, cancellationToken);
        return Ok(new { success = true, message = "Yêu cầu xuất hóa đơn điện tử GTGT thành công.", data = result });
    }

    [HttpGet("order/{orderCode:long}")]
    [Authorize]
    public async Task<IActionResult> GetByOrder(long orderCode, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetInvoiceByOrderQuery(orderCode), cancellationToken);
        if (result == null)
        {
            return NotFound(new { success = false, message = "Chưa có hóa đơn cho đơn hàng này." });
        }
        return Ok(new { success = true, data = result });
    }

    [HttpGet("lookup/{lookupCode}")]
    [AllowAnonymous]
    public async Task<IActionResult> LookupInvoice(string lookupCode, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetInvoiceLookupQuery(lookupCode), cancellationToken);
        if (result == null)
        {
            return NotFound(new { success = false, message = "Không tìm thấy hóa đơn với mã tra cứu đã nhập." });
        }
        return Ok(new { success = true, data = result });
    }
}
