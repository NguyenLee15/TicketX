namespace TickeX.WebApi.Controllers;

using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TickeX.Application.Organizer.Commands;
using TickeX.Application.Organizer.Queries;
using TickeX.WebApi.Configuration;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Organizer,Admin")]
public class OrganizerController : ControllerBase
{
    private readonly IMediator _mediator;

    public OrganizerController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("events")]
    public async Task<IActionResult> GetMyEvents(CancellationToken cancellationToken)
    {
        var userId = this.GetAuthenticatedUserId();
        if (userId == null)
            return this.UnauthorizedProblem();

        var events = await _mediator.Send(new GetOrganizerEventsQuery(userId.Value), cancellationToken);
        return Ok(new { success = true, data = events });
    }

    [HttpGet("metrics")]
    public async Task<IActionResult> GetMyMetrics(CancellationToken cancellationToken)
    {
        var userId = this.GetAuthenticatedUserId();
        if (userId == null)
            return this.UnauthorizedProblem();

        var metrics = await _mediator.Send(new GetOrganizerDashboardMetricsQuery(userId.Value), cancellationToken);
        return Ok(new { success = true, data = metrics });
    }

    [HttpGet("events/{id:guid}/tickets")]
    public async Task<IActionResult> GetEventTickets(Guid id, CancellationToken cancellationToken)
    {
        var userId = this.GetAuthenticatedUserId();
        if (userId == null)
            return this.UnauthorizedProblem();

        var isAdmin = User.IsInRole("Admin");
        var result = await _mediator.Send(new GetOrganizerEventTicketsQuery(id, userId.Value, isAdmin), cancellationToken);

        if (!result.Success)
        {
            if (result.ErrorCode == "EVENT_NOT_FOUND")
                return this.ProblemDetails(StatusCodes.Status404NotFound, result.ErrorCode, result.Message ?? "Không tìm thấy sự kiện");

            if (result.ErrorCode == "ORGANIZER_FORBIDDEN")
                return this.ProblemDetails(StatusCodes.Status403Forbidden, result.ErrorCode, result.Message ?? "Không có quyền truy cập");

            return this.BadRequestProblem(result.ErrorCode ?? "GET_TICKETS_FAILED", result.Message ?? "Không thể lấy danh sách vé");
        }

        return Ok(new { success = true, data = result.Tickets });
    }

    public record CreateOrganizerEventRequest(
        string Title,
        string Description,
        DateTime Date,
        DateTime EndDate,
        string Location,
        string VenueName,
        string? Category = "Other",
        string? ImageUrl = null,
        string? BannerUrl = null,
        decimal BasePrice = 0,
        int RefundCutoffHours = 24,
        int Rows = 10,
        int? Cols = null,
        int? SeatsPerRow = null
    );

    [HttpPost("events")]
    public async Task<IActionResult> CreateEvent([FromBody] CreateOrganizerEventRequest request, CancellationToken cancellationToken)
    {
        var userId = this.GetAuthenticatedUserId();
        if (userId == null)
            return this.UnauthorizedProblem();

        var cols = request.SeatsPerRow ?? request.Cols ?? 10;
        var imageUrl = !string.IsNullOrWhiteSpace(request.ImageUrl) ? request.ImageUrl : "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800";
        var bannerUrl = !string.IsNullOrWhiteSpace(request.BannerUrl) ? request.BannerUrl : imageUrl;
        var category = !string.IsNullOrWhiteSpace(request.Category) ? request.Category : "Concert";

        var command = new CreateOrganizerEventCommand(
            userId.Value,
            request.Title,
            request.Description,
            request.Date,
            request.EndDate,
            request.Location,
            request.VenueName,
            category,
            imageUrl,
            bannerUrl,
            request.BasePrice,
            request.RefundCutoffHours,
            request.Rows,
            cols
        );

        var result = await _mediator.Send(command, cancellationToken);
        if (!result.Success)
        {
            return this.BadRequestProblem(result.Code ?? "CREATE_EVENT_FAILED", result.Message);
        }

        return Ok(new { success = true, message = result.Message, data = new { eventId = result.EventId } });
    }
}
