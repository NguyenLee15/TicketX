using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using StackExchange.Redis;
using TickeX.Application.Events.Queries;
using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Services;

public sealed class RedisCustomerEventCatalogCache : ICustomerEventCatalogCache
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<RedisCustomerEventCatalogCache> _logger;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(45);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private const string VersionKey = "tickex:customer-catalog:version";

    public RedisCustomerEventCatalogCache(IConnectionMultiplexer redis, ILogger<RedisCustomerEventCatalogCache>? logger = null)
    {
        _redis = redis;
        _logger = logger ?? NullLogger<RedisCustomerEventCatalogCache>.Instance;
    }

    public async Task<PagedResult<EventDto>?> GetAsync(GetEventsQuery request, CancellationToken cancellationToken = default)
    {
        if (!_redis.IsConnected) return null;
        try
        {
            var database = _redis.GetDatabase();
            var version = await database.StringGetAsync(VersionKey).WaitAsync(cancellationToken).ConfigureAwait(false);
            var payload = await database.StringGetAsync(Key(version.ToString(), request)).WaitAsync(cancellationToken).ConfigureAwait(false);
            return payload.HasValue ? JsonSerializer.Deserialize<PagedResult<EventDto>>(payload!, JsonOptions) : null;
        }
        catch (Exception ex) when (ex is RedisException or RedisTimeoutException or JsonException)
        {
            _logger.LogWarning(ex, "Redis customer catalog cache read failed; falling back to direct database query.");
            return null;
        }
    }

    public async Task SetAsync(GetEventsQuery request, PagedResult<EventDto> result, CancellationToken cancellationToken = default)
    {
        if (!_redis.IsConnected) return;
        try
        {
            var database = _redis.GetDatabase();
            var version = await database.StringGetAsync(VersionKey).WaitAsync(cancellationToken).ConfigureAwait(false);
            if (!version.HasValue)
            {
                await database.StringSetAsync(VersionKey, "1", expiry: null, when: When.NotExists).WaitAsync(cancellationToken).ConfigureAwait(false);
                version = await database.StringGetAsync(VersionKey).WaitAsync(cancellationToken).ConfigureAwait(false);
            }

            var payload = JsonSerializer.Serialize(result, JsonOptions);
            await database.StringSetAsync(Key(version.ToString(), request), payload, CacheTtl).WaitAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is RedisException or RedisTimeoutException or OperationCanceledException)
        {
            _logger.LogWarning(ex, "Redis customer catalog cache set failed; falling back to database authoritative state.");
        }
    }

    public async Task InvalidateAsync(CancellationToken cancellationToken = default)
    {
        if (!_redis.IsConnected) return;
        try
        {
            await _redis.GetDatabase().StringIncrementAsync(VersionKey).WaitAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is RedisException or RedisTimeoutException)
        {
            _logger.LogWarning(ex, "Redis customer catalog cache invalidation failed; cache will expire via TTL.");
        }
    }

    private static RedisKey Key(string version, GetEventsQuery request)
    {
        var canonical = string.Join('|',
            request.Search?.Trim().ToUpperInvariant() ?? string.Empty,
            request.Category?.Trim().ToUpperInvariant() ?? string.Empty,
            request.DateFrom?.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture) ?? string.Empty,
            request.DateTo?.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture) ?? string.Empty,
            request.SortBy?.Trim().ToLowerInvariant() ?? string.Empty,
            request.Cursor?.Trim() ?? string.Empty,
            request.Page.ToString(CultureInfo.InvariantCulture),
            request.PageSize.ToString(CultureInfo.InvariantCulture),
            request.Limit?.ToString(CultureInfo.InvariantCulture) ?? string.Empty);
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)));
        return $"tickex:customer-catalog:{version}:{hash}";
    }
}
