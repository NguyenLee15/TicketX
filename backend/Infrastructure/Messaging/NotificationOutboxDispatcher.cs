using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TickeX.Application.Interfaces;
using TickeX.Application.Payments.Events;

namespace TickeX.Infrastructure.Messaging;

public sealed class NotificationOutboxDispatcher : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<NotificationOutboxDispatcher> _logger;
    public NotificationOutboxDispatcher(IServiceScopeFactory scopeFactory, ILogger<NotificationOutboxDispatcher> logger) => (_scopeFactory, _logger) = (scopeFactory, logger);
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await DispatchBatchAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { _logger.LogError(ex, "Notification outbox dispatch failed"); }

            var jitterMs = Random.Shared.Next(4500, 5500);
            try { await Task.Delay(jitterMs, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
    private async Task DispatchBatchAsync(CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        var publisher = scope.ServiceProvider.GetRequiredService<IMessagePublisher>();

        var utcNow = DateTime.UtcNow;
        var candidateIds = await context.NotificationOutbox
            .Where(x => (x.Status == "Pending" && (x.NextAttemptAt == null || x.NextAttemptAt <= utcNow))
                     || (x.Status == "Processing" && x.NextAttemptAt <= utcNow))
            .OrderBy(x => x.CreatedAt)
            .ThenBy(x => x.Id)
            .Take(20)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        if (candidateIds.Count == 0) return;

        var leaseToken = "lease:" + Guid.NewGuid().ToString("N");
        var leaseUntil = utcNow.Add(TimeSpan.FromMinutes(2));

        // Atomically claim eligible rows in a single DB update to prevent multi-instance races
        var claimedCount = await context.NotificationOutbox
            .Where(x => candidateIds.Contains(x.Id) &&
                       ((x.Status == "Pending" && (x.NextAttemptAt == null || x.NextAttemptAt <= utcNow))
                     || (x.Status == "Processing" && x.NextAttemptAt <= utcNow)))
            .ExecuteUpdateAsync(s => s
                .SetProperty(b => b.Status, "Processing")
                .SetProperty(b => b.NextAttemptAt, leaseUntil)
                .SetProperty(b => b.LastError, leaseToken)
                .SetProperty(b => b.UpdatedAt, utcNow),
                cancellationToken);

        if (claimedCount == 0) return;

        // Fetch only records securely leased by this instance
        var claimedItems = await context.NotificationOutbox
            .AsNoTracking()
            .Where(x => candidateIds.Contains(x.Id) && x.Status == "Processing" && x.LastError == leaseToken)
            .ToListAsync(cancellationToken);

        var brokerFailed = false;
        foreach (var item in claimedItems)
        {
            if (brokerFailed)
            {
                item.MarkFailed("BrokerTransportError:CascadingSkip", TimeSpan.FromSeconds(15));
            }
            else
            {
                try
                {
                    await publisher.PublishAsync(new TicketPaidEvent(item.TicketId, item.UserId, item.EventId), cancellationToken);
                    item.MarkCompleted();
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Retrying notification outbox item {OutboxId}", item.Id);
                    item.MarkFailed($"PublishFailed: {ex.GetType().Name}", TimeSpan.FromMinutes(1));
                    brokerFailed = true;
                }
            }

            var updatedCount = await context.NotificationOutbox
                .Where(x => x.Id == item.Id && x.Status == "Processing" && x.LastError == leaseToken)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(b => b.Status, item.Status)
                    .SetProperty(b => b.AttemptCount, item.AttemptCount)
                    .SetProperty(b => b.NextAttemptAt, item.NextAttemptAt)
                    .SetProperty(b => b.ProcessedAt, item.ProcessedAt)
                    .SetProperty(b => b.LastError, item.LastError)
                    .SetProperty(b => b.UpdatedAt, item.UpdatedAt),
                    cancellationToken);

            if (updatedCount == 0)
            {
                _logger.LogWarning("Outbox item {OutboxId} lease expired or was reclaimed before status update could be committed", item.Id);
            }
        }
    }
}
