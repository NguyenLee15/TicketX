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

    public record CreateOrganizerEventRequest(
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
    );

    [HttpPost("events")]
    public async Task<IActionResult> CreateEvent([FromBody] CreateOrganizerEventRequest request, CancellationToken cancellationToken)
    {
        var userId = this.GetAuthenticatedUserId();
        if (userId == null)
            return this.UnauthorizedProblem();

        var command = new CreateOrganizerEventCommand(
            userId.Value,
            request.Title,
            request.Description,
            request.Date,
            request.EndDate,
            request.Location,
            request.VenueName,
            request.Category,
            request.ImageUrl,
            request.BannerUrl,
            request.BasePrice,
            request.RefundCutoffHours,
            request.Rows,
            request.Cols
        );

        var result = await _mediator.Send(command, cancellationToken);
        if (!result.Success)
        {
            return BadRequest(new
            {
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Create Event Failed",
                status = StatusCodes.Status400BadRequest,
                success = false,
                code = result.Code ?? "CREATE_EVENT_FAILED",
                message = result.Message,
                detail = result.Message,
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier
            });
        }

        return Ok(new { success = true, message = result.Message, data = new { eventId = result.EventId } });
    }
}
