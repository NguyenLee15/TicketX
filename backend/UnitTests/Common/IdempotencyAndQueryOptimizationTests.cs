using System;
using System.IO;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using TickeX.Application.Interfaces;
using TickeX.WebApi.Filters;
using Xunit;

namespace TickeX.UnitTests.Common;

public class IdempotencyAndQueryOptimizationTests
{
    [Fact]
    public async Task ComputeBodyHashAsync_EmptyBody_ReturnsEmptyHash()
    {
        var context = new DefaultHttpContext();
        context.Request.Body = new MemoryStream();
        context.Request.ContentLength = 0;

        var result = await IdempotencyFilter.ComputeBodyHashAsync(context.Request);

        result.IsTooLarge.Should().BeFalse();
        result.Hash.Should().BeEmpty();
    }

    [Fact]
    public async Task ComputeBodyHashAsync_WhitespaceOnlyBody_ReturnsEmptyHash()
    {
        var context = new DefaultHttpContext();
        var bytes = Encoding.UTF8.GetBytes("   \r\n\t  ");
        context.Request.Body = new MemoryStream(bytes);
        context.Request.ContentLength = bytes.Length;

        var result = await IdempotencyFilter.ComputeBodyHashAsync(context.Request);

        result.IsTooLarge.Should().BeFalse();
        result.Hash.Should().BeEmpty();
    }

    [Fact]
    public async Task ComputeBodyHashAsync_StandardJsonBody_MatchesSha256Hex()
    {
        var json = "{\"orderCode\":987654321,\"seatId\":\"00000000-0000-0000-0000-000000000001\"}";
        var bytes = Encoding.UTF8.GetBytes(json);
        var expectedHash = Convert.ToHexString(SHA256.HashData(bytes));

        var context = new DefaultHttpContext();
        context.Request.Body = new MemoryStream(bytes);
        context.Request.ContentLength = bytes.Length;

        var result = await IdempotencyFilter.ComputeBodyHashAsync(context.Request);

        result.IsTooLarge.Should().BeFalse();
        result.Hash.Should().Be(expectedHash);
    }

    [Fact]
    public async Task ComputeBodyHashAsync_BodyExceeding64KB_ReturnsTooLarge()
    {
        var context = new DefaultHttpContext();
        var oversizedBytes = new byte[IdempotencyFilter.MaxIdempotentBodyBytes + 10];
        Array.Fill(oversizedBytes, (byte)'a');
        context.Request.Body = new MemoryStream(oversizedBytes);

        var result = await IdempotencyFilter.ComputeBodyHashAsync(context.Request);

        result.IsTooLarge.Should().BeTrue();
        result.Hash.Should().BeEmpty();
    }

    [Fact]
    public async Task ComputeBodyHashAsync_ContentLengthHeaderExceeding64KB_ReturnsTooLargeImmediately()
    {
        var context = new DefaultHttpContext();
        context.Request.ContentLength = IdempotencyFilter.MaxIdempotentBodyBytes + 1;
        context.Request.Body = new MemoryStream(new byte[10]);

        var result = await IdempotencyFilter.ComputeBodyHashAsync(context.Request);

        result.IsTooLarge.Should().BeTrue();
    }

    [Fact]
    public async Task IdempotencyFilter_WhenBodyExceeds64KB_Returns413PayloadTooLarge()
    {
        var storeMock = new Mock<IIdempotencyStore>();
        var filter = new IdempotencyFilter(storeMock.Object, NullLogger<IdempotencyFilter>.Instance);

        var httpContext = new DefaultHttpContext();
        var validUuidV4 = Guid.NewGuid().ToString("D");
        httpContext.Request.Headers[IdempotencyFilter.HeaderName] = validUuidV4;
        httpContext.Request.Method = "POST";
        httpContext.Request.Path = "/api/v1/seats/lock";

        var oversizedBytes = new byte[IdempotencyFilter.MaxIdempotentBodyBytes + 100];
        Array.Fill(oversizedBytes, (byte)'b');
        httpContext.Request.Body = new MemoryStream(oversizedBytes);
        httpContext.Request.ContentLength = oversizedBytes.Length;

        var actionContext = new ActionContext(httpContext, new RouteData(), new ActionDescriptor());
        var actionExecutingContext = new ActionExecutingContext(
            actionContext,
            new IFilterMetadata[0],
            new System.Collections.Generic.Dictionary<string, object?>(),
            new object());

        var nextCalled = false;
        Task<ActionExecutedContext> Next()
        {
            nextCalled = true;
            return Task.FromResult(new ActionExecutedContext(actionContext, new IFilterMetadata[0], new object()));
        }

        await filter.OnActionExecutionAsync(actionExecutingContext, Next);

        nextCalled.Should().BeFalse();
        actionExecutingContext.Result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)actionExecutingContext.Result!;
        objectResult.StatusCode.Should().Be(StatusCodes.Status413PayloadTooLarge);
    }
}
