using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;

namespace TickeX.Application.Invoices.Commands;

public record InvoiceDto(
    Guid Id,
    long OrderCode,
    string TaxCode,
    string CompanyName,
    string CompanyAddress,
    string RecipientEmail,
    decimal SubTotal,
    decimal VatRate,
    decimal VatAmount,
    decimal TotalAmount,
    string InvoiceNumber,
    string InvoiceLookupCode,
    string Status,
    DateTime? IssuedAt
);

public record CreateInvoiceRequestCommand(
    long OrderCode,
    Guid UserId,
    string TaxCode,
    string CompanyName,
    string CompanyAddress,
    string RecipientEmail,
    decimal? VatRate = null
) : IRequest<InvoiceDto>;

public class CreateInvoiceRequestCommandHandler : IRequestHandler<CreateInvoiceRequestCommand, InvoiceDto>
{
    private readonly IApplicationDbContext _context;

    public CreateInvoiceRequestCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<InvoiceDto> Handle(CreateInvoiceRequestCommand request, CancellationToken cancellationToken)
    {
        // Check if invoice already requested for this order
        var existing = await _context.Invoices
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.OrderCode == request.OrderCode, cancellationToken);

        if (existing != null)
        {
            return MapToDto(existing);
        }

        // Get total amount from tickets of the order or payment transaction
        var tickets = await _context.Tickets
            .AsNoTracking()
            .Where(t => t.OrderCode == request.OrderCode)
            .ToListAsync(cancellationToken);

        decimal totalAmount = 0;
        if (tickets.Count > 0)
        {
            totalAmount = tickets.Sum(t => t.Price);
        }
        else
        {
            var tx = await _context.PaymentTransactions
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.OrderCode == request.OrderCode, cancellationToken);

            if (tx != null)
            {
                totalAmount = tx.Amount;
            }
        }

        if (totalAmount <= 0)
        {
            throw new InvalidOperationException("Không tìm thấy đơn hàng hoặc đơn hàng có giá trị bằng 0.");
        }

        var rate = request.VatRate ?? 0.10m;
        var invoice = new Invoice(
            orderCode: request.OrderCode,
            userId: request.UserId,
            taxCode: request.TaxCode,
            companyName: request.CompanyName,
            companyAddress: request.CompanyAddress,
            recipientEmail: request.RecipientEmail,
            totalAmount: totalAmount,
            vatRate: rate
        );

        _context.Invoices.Add(invoice);
        await _context.SaveChangesAsync(cancellationToken);

        return MapToDto(invoice);
    }

    private static InvoiceDto MapToDto(Invoice i) => new(
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
