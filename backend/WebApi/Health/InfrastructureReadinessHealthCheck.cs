using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using RabbitMQ.Client;
using StackExchange.Redis;
using TickeX.Infrastructure.Persistence;

namespace TickeX.WebApi.Health;

public sealed class InfrastructureReadinessHealthCheck : IHealthCheck
{
    private readonly ApplicationDbContext _database;
    private readonly IConnectionMultiplexer _redis;
    private readonly IConfiguration _configuration;

    public InfrastructureReadinessHealthCheck(
        ApplicationDbContext database,
        IConnectionMultiplexer redis,
        IConfiguration configuration) => (_database, _redis, _configuration) = (database, redis, configuration);

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            if (!await _database.Database.CanConnectAsync(cancellationToken))
                return HealthCheckResult.Unhealthy("Database connection is unavailable.");

            var pendingMigrations = await _database.Database.GetPendingMigrationsAsync(cancellationToken);
            if (pendingMigrations.Any())
                return HealthCheckResult.Unhealthy("Pending database migrations detected.");

            if (!_redis.IsConnected)
                return HealthCheckResult.Unhealthy("Redis connection is disconnected.");

            var factory = new ConnectionFactory
            {
                HostName = _configuration["RabbitMQ:HostName"] ?? string.Empty,
                UserName = _configuration["RabbitMQ:UserName"] ?? string.Empty,
                Password = _configuration["RabbitMQ:Password"] ?? string.Empty,
                Port = _configuration.GetValue("RabbitMQ:Port", 5672),
                Ssl = new SslOption { Enabled = _configuration.GetValue("RabbitMQ:UseTls", false) }
            };

            await using var connection = await factory.CreateConnectionAsync(cancellationToken);
            return HealthCheckResult.Healthy();
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy($"Infrastructure readiness check failed: {ex.Message}", ex);
        }
    }
}
