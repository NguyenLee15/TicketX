using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace TickeX.WebApi.Configuration;

public static class ControllerProblemExtensions
{
    public static Guid? GetAuthenticatedUserId(this ControllerBase controller)
    {
        var raw = controller.User.FindFirstValue(ClaimTypes.NameIdentifier) 
            ?? controller.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(raw, out var userId) && userId != Guid.Empty ? userId : null;
    }

    public static IActionResult UnauthorizedProblem(this ControllerBase controller, string message = "User is not authenticated.")
    {
        return controller.Unauthorized(new
        {
            type = "https://datatracker.ietf.org/doc/html/rfc9457#section-3.1",
            title = "Unauthorized",
            status = StatusCodes.Status401Unauthorized,
            success = false,
            code = "UNAUTHORIZED",
            message = message,
            detail = message,
            instance = controller.HttpContext.Request.Path.Value,
            traceId = controller.HttpContext.TraceIdentifier,
            error = new { code = "UNAUTHORIZED", message = message }
        });
    }

    public static IActionResult PaginationOutOfRange(
        this ControllerBase controller, 
        string message = "page phải dương và pageSize phải nằm trong khoảng 1–50.")
    {
        return controller.BadRequest(new
        {
            type = "https://datatracker.ietf.org/doc/html/rfc9457#section-3.1",
            title = "Pagination Out Of Range",
            status = StatusCodes.Status400BadRequest,
            success = false,
            code = "PAGINATION_OUT_OF_RANGE",
            message = message,
            detail = message,
            instance = controller.HttpContext.Request.Path.Value,
            traceId = controller.HttpContext.TraceIdentifier,
            error = new { code = "PAGINATION_OUT_OF_RANGE", message = message }
        });
    }
}

