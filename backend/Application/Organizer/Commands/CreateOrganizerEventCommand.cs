namespace TickeX.Application.Organizer.Commands;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;

public record CreateOrganizerEventCommand(
    Guid OrganizerId,
    string Title,
    string Description,
    DateTime Date,
    DateTime EndDate,
    string Location,
    string VenueName,
    string Category,
    string ImageUrl,
    string BannerUrl,
    decimal BasePrice,
    int RefundCutoffHours = 24,
    int Rows = 10,
    int Cols = 10
) : IRequest<CreateOrganizerEventResult>;

public record CreateOrganizerEventResult(
    bool Success,
    string Message,
    Guid? EventId = null,
    string? Code = null
);

public class CreateOrganizerEventCommandHandler : IRequestHandler<CreateOrganizerEventCommand, CreateOrganizerEventResult>
{
    private readonly IApplicationDbContext _context;

    public CreateOrganizerEventCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<CreateOrganizerEventResult> Handle(CreateOrganizerEventCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return new CreateOrganizerEventResult(false, "Tiêu đề sự kiện không được để trống.", Code: "TITLE_EMPTY");

        if (string.IsNullOrWhiteSpace(request.Location))
            return new CreateOrganizerEventResult(false, "Địa điểm tổ chức không được để trống.", Code: "LOCATION_EMPTY");

        if (request.EndDate <= request.Date)
            return new CreateOrganizerEventResult(false, "Thời gian kết thúc phải diễn ra sau thời gian bắt đầu.", Code: "INVALID_EVENT_TIME");

        if (request.BasePrice <= 0)
            return new CreateOrganizerEventResult(false, "Giá vé cơ bản phải lớn hơn 0.", Code: "INVALID_PRICE");

        if (request.Rows <= 0 || request.Cols <= 0 || request.Rows * request.Cols > 1000)
            return new CreateOrganizerEventResult(false, "Quy mô ma trận ghế không hợp lệ (tối đa 1000 ghế).", Code: "INVALID_SEAT_DIMENSIONS");

        var organizer = await _context.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == request.OrganizerId, cancellationToken);

        if (organizer == null)
            return new CreateOrganizerEventResult(false, "Không tìm thấy tài khoản ban tổ chức.", Code: "ORGANIZER_NOT_FOUND");

        var totalSeats = request.Rows * request.Cols;
        var ev = new Event(
            request.Title.Trim(),
            request.Description?.Trim() ?? string.Empty,
            request.Date,
            request.EndDate,
            request.Location.Trim(),
            request.VenueName?.Trim() ?? request.Location.Trim(),
            totalSeats,
            string.IsNullOrWhiteSpace(request.Category) ? "Concert" : request.Category.Trim(),
            request.ImageUrl?.Trim() ?? string.Empty,
            request.BannerUrl?.Trim() ?? string.Empty,
            organizer.Name,
            request.BasePrice,
            request.RefundCutoffHours > 0 ? request.RefundCutoffHours : 24,
            EventStatus.Published,
            maxTicketsPerUser: 4,
            organizerId: request.OrganizerId
        );

        ev.GenerateSeatsMatrix(request.Rows, request.Cols);

        _context.Events.Add(ev);
        await _context.SaveChangesAsync(cancellationToken);

        return new CreateOrganizerEventResult(true, "Tạo sự kiện thành công!", EventId: ev.Id);
    }
}

