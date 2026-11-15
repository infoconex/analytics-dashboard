namespace AnalyticsDashboard.Application;

public sealed class ConnectionCredentialReader(
    IConnectionRepository repository, IConnectionSecretProtector protector)
    : IConnectionCredentialReader
{
    public async Task<string?> ReadAsync(string organizationId, Guid dataSourceId, CancellationToken token)
    {
        var connection = await repository.FindAsync(organizationId, dataSourceId, token);
        return connection?.Secret is null ? null : protector.Unprotect(connection.Secret,
            organizationId, dataSourceId, connection.Provider);
    }
}
