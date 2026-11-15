namespace AnalyticsDashboard.Application;

// Trusted server-side adapters only. Never expose this port through HTTP.
public interface IConnectionCredentialReader
{
    Task<string?> ReadAsync(string organizationId, Guid dataSourceId, CancellationToken token);
}
