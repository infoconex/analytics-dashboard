namespace AnalyticsDashboard.Application;

public sealed class ConnectionCredentialReader(
    IOrganizationCatalog organizations,
    IDataSourceRepository sources,
    IConnectionRepository repository,
    IConnectionSecretProtector protector)
    : IConnectionCredentialReader
{
    public async Task<string?> ReadAsync(string organizationId, Guid dataSourceId,
        string userId, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        if (await organizations.GetRoleAsync(organizationId, userId, token) is null)
            throw new ForbiddenException();
        var source = await sources.FindAsync(organizationId, dataSourceId, token);
        if (source is null) return null;
        var connection = await repository.FindAsync(organizationId, dataSourceId, token);
        if (connection is null || connection.IsRevoked) return null;
        if (connection.OrganizationId != organizationId || connection.DataSourceId != dataSourceId
            || connection.Provider != source.Provider)
            throw new InvalidConnectionException("Invalid connection context.");
        if (await organizations.GetRoleAsync(organizationId, userId, token) is null)
            throw new ForbiddenException();
        // This privileged read is not a runtime destination or socket permit.
        return connection.Secret is null ? null : protector.Unprotect(connection.Secret,
            organizationId, dataSourceId, source.Provider);
    }
}
