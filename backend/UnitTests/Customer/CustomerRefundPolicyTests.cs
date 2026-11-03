using FluentAssertions;
using TickeX.Application.Tickets;
using Xunit;

namespace TickeX.UnitTests.Customer;

public sealed class CustomerRefundPolicyTests
{
    [Fact]
    public void UsesTwentyFourHourDefaultWhenConfiguredCutoffIsNegative()
    {
        var eventStart = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);

        CustomerRefundPolicy.GetAllowedUntil(eventStart, -1)
            .Should().Be(new DateTime(2026, 10, 9, 12, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void AllowsRefundUpToEventStartWhenCutoffIsZero()
    {
        var eventStart = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);

        CustomerRefundPolicy.GetAllowedUntil(eventStart, 0)
            .Should().Be(eventStart);

        CustomerRefundPolicy.CanRefund(eventStart.AddHours(-1), eventStart, 0)
            .Should().BeTrue();

        CustomerRefundPolicy.CanRefund(eventStart, eventStart, 0)
            .Should().BeTrue();

        CustomerRefundPolicy.CanRefund(eventStart.AddSeconds(1), eventStart, 0)
            .Should().BeFalse();
    }

    [Fact]
    public void AllowsRefundAtTheExactCutoffBoundary()
    {
        var eventStart = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);
        var cutoff = CustomerRefundPolicy.GetAllowedUntil(eventStart, 24);

        CustomerRefundPolicy.CanRefund(cutoff, eventStart, 24).Should().BeTrue();
    }

    [Fact]
    public void RejectsRefundAfterTheCutoffBoundary()
    {
        var eventStart = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);

        CustomerRefundPolicy.CanRefund(eventStart.AddHours(-23.999), eventStart, 24).Should().BeFalse();
    }

    [Fact]
    public void CalculateTieredRefund_MoreThan48HoursBeforeEvent_Returns100Percent()
    {
        var eventStart = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);
        var now = eventStart.AddHours(-50); // 50 hours before
        decimal ticketPrice = 1_000_000m;

        var result = CustomerRefundPolicy.CalculateTieredRefund(ticketPrice, now, eventStart, 24);

        result.RefundPercentage.Should().Be(1.0m);
        result.RefundAmount.Should().Be(1_000_000m);
        result.PolicyTierDescription.Should().Contain("100%");
    }

    [Fact]
    public void CalculateTieredRefund_Between24And48HoursBeforeEvent_Returns70Percent()
    {
        var eventStart = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);
        var now = eventStart.AddHours(-36); // 36 hours before
        decimal ticketPrice = 1_000_000m;

        var result = CustomerRefundPolicy.CalculateTieredRefund(ticketPrice, now, eventStart, 24);

        result.RefundPercentage.Should().Be(0.70m);
        result.RefundAmount.Should().Be(700_000m);
        result.PolicyTierDescription.Should().Contain("70%");
    }

    [Fact]
    public void CalculateTieredRefund_LessThanCutoffHours_Returns0Percent()
    {
        var eventStart = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);
        var now = eventStart.AddHours(-12); // 12 hours before (less than 24h cutoff)
        decimal ticketPrice = 1_000_000m;

        var result = CustomerRefundPolicy.CalculateTieredRefund(ticketPrice, now, eventStart, 24);

        result.RefundPercentage.Should().Be(0m);
        result.RefundAmount.Should().Be(0m);
        result.PolicyTierDescription.Should().Contain("quá hạn");
    }
}
