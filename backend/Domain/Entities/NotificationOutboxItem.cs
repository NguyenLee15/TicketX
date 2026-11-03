namespace TickeX.Domain.Entities;

public sealed class NotificationOutboxItem : BaseEntity
{
    public const int MaxAttempts = 10;

    public Guid TicketId { get; private set; }
    public Guid UserId { get; private set; }
    public Guid EventId { get; private set; }
    public string Status { get; private set; } = "Pending";
    public int AttemptCount { get; private set; }
    public DateTime? NextAttemptAt { get; private set; }
    public DateTime? ProcessedAt { get; private set; }
    public string? LastError { get; private set; }
    public string? LeaseOwner { get; private set; }
    public DateTime? LeaseExpiresAtUtc { get; private set; }

    private NotificationOutboxItem() { }

    public NotificationOutboxItem(Guid ticketId, Guid userId, Guid eventId)
    {
        (TicketId, UserId, EventId) = (ticketId, userId, eventId);
        NextAttemptAt = DateTime.UtcNow;
    }

    public void MarkProcessing(TimeSpan leaseDuration, string? leaseToken = null)
    {
        Status = "Processing";
        LeaseOwner = leaseToken;
        LeaseExpiresAtUtc = DateTime.UtcNow.Add(leaseDuration);
        NextAttemptAt = LeaseExpiresAtUtc;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkCompleted()
    {
        Status = "Completed";
        ProcessedAt = DateTime.UtcNow;
        NextAttemptAt = null;
        LeaseOwner = null;
        LeaseExpiresAtUtc = null;
        LastError = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkFailed(string error, TimeSpan retryAfter)
    {
        AttemptCount++;
        LastError = error;
        LeaseOwner = null;
        LeaseExpiresAtUtc = null;
        UpdatedAt = DateTime.UtcNow;

        if (AttemptCount >= MaxAttempts)
        {
            Status = "DeadLettered";
            NextAttemptAt = DateTime.MaxValue;
        }
        else
        {
            Status = "Pending";
            NextAttemptAt = DateTime.UtcNow.Add(retryAfter);
        }
    }
}
