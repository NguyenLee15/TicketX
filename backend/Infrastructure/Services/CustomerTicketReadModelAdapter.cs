using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;
using TickeX.Application.Interfaces;
using TickeX.Application.Tickets;
using TickeX.Application.Tickets.Queries;
using TickeX.Domain.Enums;

namespace TickeX.Infrastructure.Services;

public sealed class CustomerTicketReadModelAdapter : ICustomerTicketReadModel
{
    private readonly IApplicationDbContext _context;
    private readonly ITimePolicy _time;

    public CustomerTicketReadModelAdapter(IApplicationDbContext context, ITimePolicy time)
    {
        _context = context;
        _time = time;
    }

    public async Task<IReadOnlyList<TicketDto>> GetForUserAsync(Guid userId, int? page = null, int? pageSize = null, string? status = null, CancellationToken cancellationToken = default)
    {
        var query = _context.Tickets
            .AsNoTracking()
            .Where(t => t.UserId == userId && t.Event != null && t.Seat != null);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<TicketStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(t => t.Status == parsedStatus);
        }

        query = query
            .OrderByDescending(t => t.CreatedAt)
            .ThenByDescending(t => t.Id);

        var effectivePage = page ?? 1;
        var effectivePageSize = pageSize ?? 10;
        if (effectivePage < 1 || effectivePageSize is < 1 or > 50)
            throw new ArgumentOutOfRangeException(nameof(page), "page must be positive and pageSize must be between 1 and 50.");
        var offset = checked(((long)effectivePage - 1) * effectivePageSize);
        if (offset > int.MaxValue)
            throw new ArgumentOutOfRangeException(nameof(page), "page offset exceeds the supported range.");

        var tickets = await query
            .Skip((int)offset)
            .Take(effectivePageSize)
            .Select(t => new TicketRowProjection(
                t.Id, t.EventId, t.SeatId, t.Event!.Title, t.Event.Description,
                t.Event.Date, t.Event.EndDate, t.Event.Location, t.Event.VenueName, t.Event.Category,
                t.Event.ImageUrl, t.Seat!.Row, t.Seat.Number, t.Seat.Tier, t.Price, t.Status,
                t.OrderCode, t.QrCodeSignature, t.PaidAt, t.CheckedInAt, t.RefundAmount, t.RefundedAt,
                t.Event.RefundCutoffHours, t.CreatedAt))
            .ToListAsync(cancellationToken);

        var now = _time.UtcNow;
        return tickets.Select(ticket => ToDto(ticket, now)).ToList();
    }

    public async Task<TicketCursorPage> GetForUserCursorAsync(Guid userId, string? cursor, int limit, string? status, CancellationToken cancellationToken = default)
    {
        if (limit is < 1 or > 50)
            throw new ArgumentOutOfRangeException(nameof(limit), "limit must be between 1 and 50.");

        var query = _context.Tickets
            .AsNoTracking()
            .Where(t => t.UserId == userId && t.Event != null && t.Seat != null);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<TicketStatus>(status, true, out var parsedStatus))
            query = query.Where(t => t.Status == parsedStatus);

        query = query.OrderByDescending(t => t.CreatedAt).ThenByDescending(t => t.Id);
        if (!string.IsNullOrWhiteSpace(cursor))
        {
            var decoded = DecodeCursor(cursor);
            query = query.Where(t => t.CreatedAt < decoded.CreatedAt || (t.CreatedAt == decoded.CreatedAt && t.Id.CompareTo(decoded.Id) < 0));
        }

        var rows = await query
            .Take(limit + 1)
            .Select(t => new TicketRowProjection(
                t.Id, t.EventId, t.SeatId, t.Event!.Title, t.Event.Description,
                t.Event.Date, t.Event.EndDate, t.Event.Location, t.Event.VenueName, t.Event.Category,
                t.Event.ImageUrl, t.Seat!.Row, t.Seat.Number, t.Seat.Tier, t.Price, t.Status,
                t.OrderCode, t.QrCodeSignature, t.PaidAt, t.CheckedInAt, t.RefundAmount, t.RefundedAt,
                t.Event.RefundCutoffHours, t.CreatedAt))
            .ToListAsync(cancellationToken);

        var hasMore = rows.Count > limit;
        if (hasMore) rows.RemoveAt(limit);
        var now = _time.UtcNow;
        var items = rows.Select(ticket => ToDto(ticket, now)).ToList();
        var last = rows.LastOrDefault();
        var nextCursor = hasMore && last is not null ? EncodeCursor(last.CreatedAt, last.Id) : null;
        return new TicketCursorPage(items, nextCursor, hasMore);
    }

    private static TicketDto ToDto(TicketRowProjection ticket, DateTime now)
    {
        var cutoffHours = CustomerRefundPolicy.NormalizeCutoffHours(ticket.RefundCutoffHours);
        var canRefund = ticket.Status == TicketStatus.Paid
            && CustomerRefundPolicy.CanRefund(now, ticket.EventDate, cutoffHours);
        return new TicketDto(ticket.Id, ticket.EventId, ticket.SeatId, ticket.EventTitle, ticket.EventDescription,
            ticket.EventDate, ticket.EndDate, ticket.Location, ticket.VenueName, ticket.Category,
            ticket.ImageUrl, ticket.Row, ticket.Number, ticket.Tier, ticket.Price, ticket.Status.ToString(),
            ticket.OrderCode, ticket.QrCodeSignature, ticket.PaidAt, ticket.CheckedInAt, ticket.RefundAmount, ticket.RefundedAt,
            cutoffHours, canRefund);
    }

    private static string EncodeCursor(DateTime createdAt, Guid id)
    {
        var value = new TicketCursor(createdAt, id);
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value)))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static TicketCursor DecodeCursor(string encoded)
    {
        try
        {
            var padded = encoded.Replace('-', '+').Replace('_', '/');
            padded += new string('=', (4 - padded.Length % 4) % 4);
            var cursor = JsonSerializer.Deserialize<TicketCursor>(Convert.FromBase64String(padded));
            if (cursor is null || cursor.Id == Guid.Empty) throw new ArgumentException("Cursor không hợp lệ.", nameof(encoded));
            return cursor;
        }
        catch (JsonException ex) { throw new ArgumentException("Cursor không hợp lệ.", nameof(encoded), ex); }
        catch (FormatException ex) { throw new ArgumentException("Cursor không hợp lệ.", nameof(encoded), ex); }
    }

    private sealed record TicketCursor(DateTime CreatedAt, Guid Id);

    private sealed record TicketRowProjection(
        Guid Id,
        Guid EventId,
        Guid SeatId,
        string EventTitle,
        string EventDescription,
        DateTime EventDate,
        DateTime EndDate,
        string Location,
        string VenueName,
        string Category,
        string ImageUrl,
        string Row,
        int Number,
        SeatTier Tier,
        decimal Price,
        TicketStatus Status,
        long OrderCode,
        string QrCodeSignature,
        DateTime? PaidAt,
        DateTime? CheckedInAt,
        decimal? RefundAmount,
        DateTime? RefundedAt,
        int RefundCutoffHours,
        DateTime CreatedAt);
}
