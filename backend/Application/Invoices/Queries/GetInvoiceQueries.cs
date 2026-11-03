using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Invoices.Commands;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Invoices.Queries;

public record GetInvoiceByOrderQuery(long OrderCode) : IRequest<InvoiceDto?>;

public record GetInvoiceLookupQuery(string LookupCode) : IRequest<InvoiceDto?>;

public class GetInvoiceQueriesHandler :
    IRequestHandler<GetInvoiceByOrderQuery, InvoiceDto?>,
    IRequestHandler<GetInvoiceLookupQuery, InvoiceDto?>
{
    private readonly IApplicationDbContext _context;

    public GetInvoiceQueriesHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<InvoiceDto?> Handle(GetInvoiceByOrderQuery request, CancellationToken cancellationToken)
    {
        var invoice = await _context.Invoices
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.OrderCode == request.OrderCode, cancellationToken);

        return invoice == null ? null : MapToDto(invoice);
    }

    public async Task<InvoiceDto?> Handle(GetInvoiceLookupQuery request, CancellationToken cancellationToken)
    {
        var code = request.LookupCode.Trim().ToUpperInvariant();
        var invoice = await _context.Invoices
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.InvoiceLookupCode.ToUpper() == code, cancellationToken);

        return invoice == null ? null : MapToDto(invoice);
    }

    private static InvoiceDto MapToDto(Domain.Entities.Invoice i) => new(
        Id: i.Id,
        OrderCode: i.OrderCode,
        TaxCode: i.TaxCode,
        CompanyName: i.CompanyName,
        CompanyAddress: i.CompanyAddress,
        RecipientEmail: i.RecipientEmail,
        SubTotal: i.SubTotal,
        VatRate: i.VatRate,
        VatAmount: i.VatAmount,
        TotalAmount: i.TotalAmount,
        InvoiceNumber: i.InvoiceNumber,
        InvoiceLookupCode: i.InvoiceLookupCode,
        Status: i.Status.ToString(),
        IssuedAt: i.IssuedAt
    );
}
