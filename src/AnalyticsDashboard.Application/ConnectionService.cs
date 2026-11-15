using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

public sealed class ConnectionService(
    IDataSourceRepository dataSources,
    IOrganizationCatalog organizations,
    IConnectionRepository connections,
    IConnectionSecretProtector protector,
    IConnectionDestinationPolicy destinations,
    ISqliteFilePolicy sqliteFiles,
    TimeProvider clock)
{
    public async Task<ConnectionStatus?> FindAsync(string organizationId, Guid id,
        string userId, CancellationToken token)
    {
        await RequireOwnerAsync(organizationId, userId, token);
        if (await dataSources.FindAsync(organizationId, id, token) is null) return null;
        var profile = await connections.FindAsync(organizationId, id, token);
        return profile is null ? null : ToStatus(profile);
    }

    public async Task<ConnectionStatus?> ConfigureAsync(string organizationId, Guid id,
        string userId, ConnectionConfigurationRequest request, CancellationToken token)
    {
        await RequireOwnerAsync(organizationId, userId, token);
        var source = await dataSources.FindAsync(organizationId, id, token);
        if (source is null) return null;
        if (request is null || request.ExpectedRevision < 0)
            throw new InvalidConnectionException("Invalid connection configuration.");

        NetworkConnectionDetails? network = null;
        string? sqliteFileId = null;
        ProtectedConnectionSecret? secret = null;
        if (source.Provider == DataSourceProvider.Sqlite)
        {
            if (request.Network is not null || request.Sqlite is null || request.Credential is not null)
                throw new InvalidConnectionException("Invalid SQLite connection configuration.");
            sqliteFiles.Validate(request.Sqlite.FileId);
            sqliteFileId = request.Sqlite.FileId;
        }
        else
        {
            if (request.Network is null || request.Sqlite is not null)
                throw new InvalidConnectionException("Invalid network connection configuration.");
            ValidateCredential(request.Credential);
            network = ValidateNetworkShape(source.Provider, request.Network);
            var approval = await destinations.ValidateAsync(source.Provider, network, token);
            network = network with { Host = approval.Host };
            secret = protector.Protect(request.Credential!, organizationId, id, source.Provider);
        }

        var previous = await connections.FindAsync(organizationId, id, token);
        if ((previous?.Revision ?? 0) != request.ExpectedRevision) throw new ConflictException();
        var profile = new ConnectionProfile(organizationId, id, source.Provider, network,
            sqliteFileId, secret, request.ExpectedRevision + 1, clock.GetUtcNow());
        if (!await connections.SaveAsync(profile, request.ExpectedRevision, userId,
                previous is null ? "configured" : "reconfigured", token)) throw new ConflictException();
        return ToStatus(profile);
    }

    public async Task<ConnectionStatus?> RotateAsync(string organizationId, Guid id,
        string userId, ConnectionCredentialRotation request, CancellationToken token)
    {
        await RequireOwnerAsync(organizationId, userId, token);
        var source = await dataSources.FindAsync(organizationId, id, token);
        if (source is null) return null;
        if (source.Provider == DataSourceProvider.Sqlite || request is null || request.ExpectedRevision < 1)
            throw new InvalidConnectionException("Invalid credential rotation.");
        ValidateCredential(request.Credential);
        var existing = await connections.FindAsync(organizationId, id, token);
        if (existing is null) return null;
        if (existing.Revision != request.ExpectedRevision) throw new ConflictException();
        // Revalidate the destination: stored DNS approval is never a permanent grant.
        await destinations.ValidateAsync(source.Provider, existing.Network!, token);
        var next = existing with
        {
            Secret = protector.Protect(request.Credential, organizationId, id, source.Provider),
            Revision = existing.Revision + 1,
            ConfiguredAt = clock.GetUtcNow()
        };
        if (!await connections.SaveAsync(next, request.ExpectedRevision, userId, "credential-rotated", token))
            throw new ConflictException();
        return ToStatus(next);
    }

    public async Task<ConnectionStatus?> RewrapAsync(string organizationId, Guid id,
        string userId, ConnectionRevisionRequest request, CancellationToken token)
    {
        await RequireOwnerAsync(organizationId, userId, token);
        var source = await dataSources.FindAsync(organizationId, id, token);
        if (source is null) return null;
        if (request is null || request.ExpectedRevision < 1)
            throw new InvalidConnectionException("Invalid rewrap revision.");
        var existing = await connections.FindAsync(organizationId, id, token);
        if (existing is null) return null;
        if (existing.Revision != request.ExpectedRevision) throw new ConflictException();
        if (existing.Secret is null)
            throw new InvalidConnectionException("No credential is configured.");
        var plaintext = protector.Unprotect(existing.Secret, organizationId, id, source.Provider);
        var next = existing with
        {
            Secret = protector.Protect(plaintext, organizationId, id, source.Provider),
            Revision = existing.Revision + 1,
            ConfiguredAt = clock.GetUtcNow()
        };
        if (!await connections.SaveAsync(next, request.ExpectedRevision, userId, "key-rewrapped", token))
            throw new ConflictException();
        return ToStatus(next);
    }

    public async Task<bool> RevokeAsync(string organizationId, Guid id, string userId,
        int expectedRevision, CancellationToken token)
    {
        await RequireOwnerAsync(organizationId, userId, token);
        if (expectedRevision < 1) throw new InvalidConnectionException("Invalid revision.");
        if (await dataSources.FindAsync(organizationId, id, token) is null) return false;
        var existing = await connections.FindAsync(organizationId, id, token);
        if (existing is null) return false;
        if (existing.Revision != expectedRevision) throw new ConflictException();
        if (!await connections.DeleteAsync(organizationId, id, expectedRevision, userId, token))
            throw new ConflictException();
        return true;
    }

    private async Task RequireOwnerAsync(string organizationId, string userId, CancellationToken token)
    {
        if (await organizations.GetRoleAsync(organizationId, userId, token) != OrganizationRole.Owner)
            throw new ForbiddenException();
    }

    private static NetworkConnectionDetails ValidateNetworkShape(DataSourceProvider provider,
        NetworkConnectionRequest value)
    {
        if (value.Port is < 1 or > 65535)
            throw new InvalidConnectionException("Invalid network port.");
        if (provider == DataSourceProvider.Elasticsearch)
        {
            if (value.Database is not null || !string.IsNullOrWhiteSpace(value.Username))
                throw new InvalidConnectionException("Elasticsearch credentials must use a secret token.");
        }
        else if (string.IsNullOrWhiteSpace(value.Database) || string.IsNullOrWhiteSpace(value.Username)
            || value.Database.Length > 128 || value.Username.Length > 128
            || !IsSafeIdentifier(value.Database) || !IsSafeIdentifier(value.Username))
        {
            throw new InvalidConnectionException("Invalid relational connection configuration.");
        }
        return new NetworkConnectionDetails(value.Host, value.Port,
            value.Database?.Trim(), value.Username?.Trim());
    }

    private static void ValidateCredential(string? credential)
    {
        if (string.IsNullOrWhiteSpace(credential) || credential.Length > 4096
            || credential.Any(char.IsControl))
            throw new InvalidConnectionException("Invalid credential.");
    }

    private static bool IsSafeIdentifier(string value) => value.All(c =>
        char.IsAsciiLetterOrDigit(c) || c is '_' or '-' or '.' or '@');

    private static ConnectionStatus ToStatus(ConnectionProfile profile) =>
        new(profile.Provider, profile.Secret is not null, profile.Revision,
            profile.ConfiguredAt, profile.Network is null ? "sqlite" : "network");
}
