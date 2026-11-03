using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TickeX.Application.Analytics.Queries;

namespace TickeX.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Staff,Organizer")]
public class AnalyticsController : ControllerBase
{
    private readonly IMediator _mediator;

    public AnalyticsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("events/{eventId:guid}/attendance")]
    public async Task<IActionResult> GetAttendanceAnalytics(Guid eventId, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetEventAttendanceAnalyticsQuery(eventId), cancellationToken);
        return Ok(new { success = true, data = result });
    }
}
