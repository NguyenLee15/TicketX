using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace TickeX.WebApi.Configuration;

public static class ControllerProblemExtensions
{
    public const string Rfc9457Type = "https://datatracker.ietf.org/doc/html/rfc9457#section-3.1";

    public static Guid? GetAuthenticatedUserId(this ControllerBase controller)
    {
        var raw = controller.User.FindFirstValue(ClaimTypes.NameIdentifier) 
            ?? controller.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(raw, out var userId) && userId != Guid.Empty ? userId : null;
    }

    public static IActionResult ProblemDetails(
        this ControllerBase controller,
        int statusCode,
        string? code,
        string? message,
        string? title = null,
        string? detail = null)
    {
        var effectiveCode = !string.IsNullOrWhiteSpace(code) ? code : "ERROR";
        var effectiveMessage = !string.IsNullOrWhiteSpace(message) ? message : "An error occurred.";

        title ??= statusCode switch
        {
            StatusCodes.Status400BadRequest => "Bad Request",
            StatusCodes.Status401Unauthorized => "Unauthorized",
            StatusCodes.Status403Forbidden => "Forbidden",
            StatusCodes.Status404NotFound => "Not Found",
            StatusCodes.Status409Conflict => "Conflict",
            StatusCodes.Status413PayloadTooLarge => "Payload Too Large",
            StatusCodes.Status503ServiceUnavailable => "Service Unavailable",
            _ => "Error"
        };

        return controller.StatusCode(statusCode, new
        {
            type = Rfc9457Type,
            title,
            status = statusCode,
            success = false,
            code = effectiveCode,
            message = effectiveMessage,
            detail = detail ?? effectiveMessage,
            instance = controller.HttpContext.Request.Path.Value,
            traceId = controller.HttpContext.TraceIdentifier,
            error = new { code = effectiveCode, message = effectiveMessage }
        });
    }

    public static IActionResult BadRequestProblem(this ControllerBase controller, string? code, string? message) =>
        controller.ProblemDetails(StatusCodes.Status400BadRequest, code, message);

    public static IActionResult NotFoundProblem(this ControllerBase controller, string? code, string? message) =>
        controller.ProblemDetails(StatusCodes.Status404NotFound, code, message);

    public static IActionResult ConflictProblem(this ControllerBase controller, string? code, string? message) =>
        controller.ProblemDetails(StatusCodes.Status409Conflict, code, message);

    public static IActionResult ForbiddenProblem(this ControllerBase controller, string? code, string? message) =>
        controller.ProblemDetails(StatusCodes.Status403Forbidden, code, message);

    public static IActionResult ServiceUnavailableProblem(this ControllerBase controller, string? code, string? message) =>
        controller.ProblemDetails(StatusCodes.Status503ServiceUnavailable, code, message);

    public static IActionResult UnauthorizedProblem(this ControllerBase controller, string message = "User is not authenticated.") =>
        controller.ProblemDetails(StatusCodes.Status401Unauthorized, "UNAUTHORIZED", message);

    public static IActionResult PaginationOutOfRange(
        this ControllerBase controller, 
        string message = "page phải dương và pageSize phải nằm trong khoảng 1–50.") =>
        controller.ProblemDetails(StatusCodes.Status400BadRequest, "PAGINATION_OUT_OF_RANGE", message);
}

