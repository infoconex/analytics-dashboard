namespace AnalyticsDashboard.Application;

// Trusted server-side adapters only. Never expose this port through HTTP.
// The caller must supply a server-authenticated actor for tenant authorization.
public interface IConnectionCredentialReader
{
    Task<string?> ReadAsync(string organizationId, Guid dataSourceId, string userId,
        CancellationToken token);
}
