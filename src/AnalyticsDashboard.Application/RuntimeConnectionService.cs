using System.Data;
using System.Data.Common;
using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

/// <summary>
/// Internal, authorization-first attempt to acquire a runtime relational session.
/// Not exposed through HTTP; the production transport remains unconfigured.
/// </summary>
public sealed class RuntimeConnectionService(
    IOrganizationCatalog organizations,
    IDataSourceRepository dataSources,
    IConnectionRepository connections,
    IConnectionDestinationPolicy destinations,
    IConnectionSecretProtector secrets,
    IRuntimeRelationalTransport transport)
{
    public async Task<DbConnection?> OpenAsync(string organizationId, Guid dataSourceId,
        string userId, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        // No source/profile/network/key/provider access before membership authorization.
        if (await organizations.GetRoleAsync(organizationId, userId, token) is null)
            throw new ForbiddenException();

        var source = await dataSources.FindAsync(organizationId, dataSourceId, token);
        if (source is null) return null;
        if (source.Provider is not (DataSourceProvider.SqlServer or DataSourceProvider.PostgreSql))
            throw new InvalidConnectionException("Runtime relational connection is unavailable.");

        var profile = await connections.FindAsync(organizationId, dataSourceId, token);
        if (profile is null || profile.IsRevoked || profile.Provider != source.Provider
            || profile.OrganizationId != organizationId || profile.DataSourceId != dataSourceId
            || profile.Network is null || profile.Secret is null || profile.SqliteFileId is not null
            || !IsValidRelationalName(profile.Network.Database)
            || !IsValidRelationalName(profile.Network.Username))
            throw new InvalidConnectionException("Runtime relational connection is unavailable.");

        // Prevent DNS or key access when the deployment cannot meet the hard transport gates.
        try
        {
            await transport.EnsureReadyAsync(token);
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception)
        {
            // Never forward a provider/broker exception that might include a credential or host.
            throw new ConnectionSecurityUnavailableException();
        }
        token.ThrowIfCancellationRequested();

        // Stored approval from registration/rotation is never a connect-time permit.
        var destination = await destinations.ValidateAsync(source.Provider, profile.Network, token);
        token.ThrowIfCancellationRequested();

        // Membership and registration may be revoked during an asynchronous DNS lookup.
        if (await organizations.GetRoleAsync(organizationId, userId, token) is null)
            throw new ForbiddenException();
        if (!await IsCurrentAsync(profile, token)) throw new ConflictException();
        if (await dataSources.FindAsync(organizationId, dataSourceId, token) is not { } currentSource
            || currentSource.Provider != source.Provider)
            throw new ConflictException();

        // Decryption occurs only after membership, source, transport and DNS authorization.
        var credential = secrets.Unprotect(profile.Secret, organizationId, dataSourceId, source.Provider);
        token.ThrowIfCancellationRequested();
        var request = new RuntimeRelationalConnection(organizationId, dataSourceId,
            source.Provider, profile.Network, destination, profile.Revision);
        DbConnection session;
        try
        {
            session = await transport.OpenAsync(request, credential, token);
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception)
        {
            throw new ConnectionSecurityUnavailableException();
        }
        if (session is null) throw new ConnectionSecurityUnavailableException();
        try
        {
            token.ThrowIfCancellationRequested();
            if (session.State != ConnectionState.Open)
                throw new ConnectionSecurityUnavailableException();
            // Reject a session opened across a rotation, revoke or registration deletion.
            if (await organizations.GetRoleAsync(organizationId, userId, token) is null)
                throw new ForbiddenException();
            if (!await IsCurrentAsync(profile, token)
                || await dataSources.FindAsync(organizationId, dataSourceId, token) is not { } latest
                || latest.Provider != source.Provider)
                throw new ConflictException();
            return session;
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested)
        {
            await DisposeWithoutDisclosureAsync(session);
            throw;
        }
        catch (ForbiddenException)
        {
            await DisposeWithoutDisclosureAsync(session);
            throw;
        }
        catch (ConflictException)
        {
            await DisposeWithoutDisclosureAsync(session);
            throw;
        }
        catch (Exception)
        {
            await DisposeWithoutDisclosureAsync(session);
            throw new ConnectionSecurityUnavailableException();
        }
    }

    private async Task<bool> IsCurrentAsync(ConnectionProfile original, CancellationToken token)
    {
        var current = await connections.FindAsync(original.OrganizationId, original.DataSourceId, token);
        return current is not null && !current.IsRevoked
            && current.Revision == original.Revision
            && current.Provider == original.Provider;
    }

    private static bool IsValidRelationalName(string? value) =>
        !string.IsNullOrWhiteSpace(value) && value.Length <= 128 && value.All(c =>
            char.IsAsciiLetterOrDigit(c) || c is '_' or '-' or '.' or '@');

    private static async Task DisposeWithoutDisclosureAsync(DbConnection connection)
    {
        try
        {
            await connection.DisposeAsync();
        }
        catch (Exception)
        {
            // Cleanup must be attempted, but exceptions must not expose provider diagnostics.
        }
    }
}
