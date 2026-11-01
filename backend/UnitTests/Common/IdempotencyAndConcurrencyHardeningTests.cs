using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using FluentAssertions;
using TickeX.Domain.Entities;
using Xunit;

namespace TickeX.UnitTests.Common;

public class IdempotencyAndConcurrencyHardeningTests
{
    [Fact]
    public void PaymentTransaction_AllMutators_MustRotateVersionAndTouchUpdatedAt()
    {
        var tx = new PaymentTransaction(123456L, Guid.NewGuid(), 100000m);
        var initialVersion = tx.Version.ToArray();

        tx.SetCheckoutUrl("https://pay.example.com/checkout");
        tx.Version.Should().NotEqual(initialVersion);
        var v1 = tx.Version.ToArray();

        tx.SetWebhookPayloadHash("hash123456");
        tx.Version.Should().NotEqual(v1);
        var v2 = tx.Version.ToArray();

        tx.MarkSuccess("TX_SUCCESS", "payload");
        tx.Version.Should().NotEqual(v2);
        var v3 = tx.Version.ToArray();

        tx.MarkRefundInitiated("payload");
        tx.Version.Should().NotEqual(v3);
        var v4 = tx.Version.ToArray();

        tx.MarkRefunded("TX_REFUND", "payload");
        tx.Version.Should().NotEqual(v4);
        var v5 = tx.Version.ToArray();

        tx.MarkRefundFailed("reason", "payload");
        tx.Version.Should().NotEqual(v5);
        var v6 = tx.Version.ToArray();

        tx.ResetPending();
        tx.Version.Should().NotEqual(v6);
        var v7 = tx.Version.ToArray();

        tx.MarkFailed("cancelled", "payload");
        tx.Version.Should().NotEqual(v7);
        var v8 = tx.Version.ToArray();

        tx.MarkOrphaned("orphaned", "TX_ORPHAN", "payload");
        tx.Version.Should().NotEqual(v8);
    }

    [Fact]
    public void Ticket_SetQrSignature_And_RegenerateOrderCode_MustRotateVersion()
    {
        var ticket = new Ticket(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 250000m);
        var initialVersion = ticket.Version.ToArray();

        ticket.SetQrSignature("NEW_QR_SIG_999");
        ticket.Version.Should().NotEqual(initialVersion);
        var v1 = ticket.Version.ToArray();

        ticket.RegenerateOrderCode();
        ticket.Version.Should().NotEqual(v1);
    }

    [Fact]
    public void User_FailedLoginMethods_MustRotateVersion()
    {
        var user = new User("Test User", "test@example.com", "hash");
        var initialVersion = user.Version.ToArray();

        user.RecordFailedLogin();
        user.Version.Should().NotEqual(initialVersion);
        var v1 = user.Version.ToArray();

        user.ResetFailedLogin();
        user.Version.Should().NotEqual(v1);
    }

    [Fact]
    public void SeatRows_NaturalOrder_ShouldSortMultiLetterRowsAfterSingleLetterRows()
    {
        // Simulating rows: A, B, Z, AA, AB, AC
        var rawRows = new[] { "AA", "B", "AB", "A", "Z", "AC" };
        var sorted = rawRows
            .OrderBy(r => r.Length)
            .ThenBy(r => r, StringComparer.Ordinal)
            .ToList();

        sorted.Should().ContainInOrder("A", "B", "Z", "AA", "AB", "AC");
    }

    [Fact]
    public void IdempotencyRecord_WebDefaults_MustSerializeWithCamelCase()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var payload = new TestPayload { TicketId = Guid.NewGuid(), PriceAmount = 150000m };
        var json = JsonSerializer.Serialize(payload, options);

        json.Should().Contain("\"ticketId\":");
        json.Should().Contain("\"priceAmount\":");
        json.Should().NotContain("\"TicketId\":");
        json.Should().NotContain("\"PriceAmount\":");
    }

    private sealed class TestPayload
    {
        public Guid TicketId { get; set; }
        public decimal PriceAmount { get; set; }
    }
}
