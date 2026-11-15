using System.Net;
using System.Security.Cryptography;
using System.Text;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using AnalyticsDashboard.Infrastructure;
using Microsoft.Data.Sqlite;

namespace AnalyticsDashboard.Tests;

public sealed class ConnectionServiceTests
{
    private sealed class PublicDns : IDnsResolver
    {
        public Task<IPAddress[]> ResolveAsync(string host, CancellationToken token) =>
            Task.FromResult(new[] { IPAddress.Parse("8.8.8.8") });
    }

    private sealed class ChangingDns : IDnsResolver
    {
        public bool Rebound { get; set; }
        public Task<IPAddress[]> ResolveAsync(string host, CancellationToken token) => Task.FromResult(
            new[] { IPAddress.Parse(Rebound ? "169.254.169.254" : "8.8.8.8") });
    }

    private string databasePath = null!;
    private SqliteCatalog organizations = null!;
    private SqliteDataSourceRepository definitions = null!;
    private SqliteConnectionRepository repository = null!;
    private ConnectionService service = null!;
    private IConnectionSecretProtector protector = null!;
    private Guid sourceId;

    [SetUp]
    public async Task SetUp()
    {
        databasePath = Path.Combine(Path.GetTempPath(), $"analytics-connection-{Guid.NewGuid():N}.db");
        organizations = new SqliteCatalog(databasePath);
        await organizations.InitializeAsync();
        await organizations.SeedDevelopmentAsync();
        definitions = new SqliteDataSourceRepository(databasePath);
        await definitions.InitializeAsync();
        repository = new SqliteConnectionRepository(databasePath);
        await repository.InitializeAsync();
        var source = await new DataSourceService(definitions, organizations, repository, TimeProvider.System)
            .CreateAsync("northstar", "demo-owner",
                new DataSourceDraft("Reporting", DataSourceProvider.PostgreSql), CancellationToken.None);
        sourceId = source.Id;
        protector = new AesGcmConnectionSecretProtector("test-v1",
            new Dictionary<string, string>
            {
                ["test-v1"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            });
        service = new ConnectionService(definitions, organizations, repository, protector,
            new ApprovedDestinationPolicy(new Dictionary<DataSourceProvider, IReadOnlySet<string>>
            {
                [DataSourceProvider.PostgreSql] = new HashSet<string> { "db.example.com:5432" }
            }, new PublicDns()), new MappedSqliteFilePolicy(null, new Dictionary<string, string>(), databasePath),
            TimeProvider.System);
    }

    [TearDown]
    public void TearDown()
    {
        SqliteConnection.ClearAllPools();
        if (File.Exists(databasePath)) File.Delete(databasePath);
    }

    [Test]
    public async Task CreateRotateRewrapRevokeKeepCredentialInsideProtectedStorage()
    {
        var created = await service.ConfigureAsync("northstar", sourceId, "demo-owner",
            Request("sentinel-secret-one", 0), CancellationToken.None);
        var reader = new ConnectionCredentialReader(repository, protector);
        Assert.Multiple(() =>
        {
            Assert.That(created?.Revision, Is.EqualTo(1));
            Assert.That(created?.HasCredential, Is.True);
            Assert.That(created?.Kind, Is.EqualTo("network"));
        });
        var rotated = await service.RotateAsync("northstar", sourceId, "demo-owner",
            new ConnectionCredentialRotation("sentinel-secret-two", 1), CancellationToken.None);
        var rewrapped = await service.RewrapAsync("northstar", sourceId, "demo-owner",
            new ConnectionRevisionRequest(2), CancellationToken.None);
        var secret = await reader.ReadAsync("northstar", sourceId, CancellationToken.None);
        var otherTenant = await reader.ReadAsync("isolated", sourceId, CancellationToken.None);
        var saved = await repository.FindAsync("northstar", sourceId, CancellationToken.None);
        var revoked = await service.RevokeAsync("northstar", sourceId, "demo-owner", 3,
            CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(rotated?.Revision, Is.EqualTo(2));
            Assert.That(rewrapped?.Revision, Is.EqualTo(3));
            Assert.That(secret, Is.EqualTo("sentinel-secret-two"));
            Assert.That(otherTenant, Is.Null);
            Assert.That(saved?.Secret?.Ciphertext, Is.Not.Null.And.Not.EqualTo("sentinel-secret-two"));
            Assert.That(revoked, Is.True);
        });
        Assert.That(await reader.ReadAsync("northstar", sourceId, CancellationToken.None), Is.Null);
        var tombstone = await repository.FindAsync("northstar", sourceId, CancellationToken.None);
        Assert.Multiple(() =>
        {
            Assert.That(tombstone?.IsRevoked, Is.True);
            Assert.That(tombstone?.Revision, Is.EqualTo(4));
            Assert.That(tombstone?.Secret, Is.Null);
            Assert.That(tombstone?.Network, Is.Null);
        });
        var bytes = await File.ReadAllBytesAsync(databasePath);
        var disk = Encoding.UTF8.GetString(bytes);
        Assert.Multiple(() =>
        {
            Assert.That(disk, Does.Not.Contain("sentinel-secret-one"));
            Assert.That(disk, Does.Not.Contain("sentinel-secret-two"));
        });
    }

    [Test]
    public async Task UnauthorizedUsersCannotEvenInspectConnectionStatus()
    {
        await service.ConfigureAsync("northstar", sourceId, "demo-owner",
            Request("first-credential", 0), CancellationToken.None);
        foreach (var actor in new[] { "demo-viewer", "another-user", "unknown" })
        {
            await Assert.ThrowsAsync<ForbiddenException>(async () =>
                await service.FindAsync("northstar", sourceId, actor, CancellationToken.None));
            await Assert.ThrowsAsync<ForbiddenException>(async () =>
                await service.ConfigureAsync("northstar", sourceId, actor,
                    Request("replacement", 1), CancellationToken.None));
            await Assert.ThrowsAsync<ForbiddenException>(async () =>
                await service.RotateAsync("northstar", sourceId, actor,
                    new ConnectionCredentialRotation("replacement", 1), CancellationToken.None));
            await Assert.ThrowsAsync<ForbiddenException>(async () =>
                await service.RevokeAsync("northstar", sourceId, actor, 1, CancellationToken.None));
        }
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.FindAsync("isolated", sourceId, "demo-owner", CancellationToken.None));
        Assert.That(await service.FindAsync("northstar", Guid.NewGuid(), "demo-owner",
            CancellationToken.None), Is.Null);
    }

    [Test]
    public async Task CompareAndSwapPreventsStaleWritesAndTenantBoundariesHoldInRepository()
    {
        await service.ConfigureAsync("northstar", sourceId, "demo-owner",
            Request("first", 0), CancellationToken.None);
        await service.ConfigureAsync("northstar", sourceId, "demo-owner",
            Request("second", 1), CancellationToken.None);
        await Assert.ThrowsAsync<ConflictException>(async () =>
            await service.ConfigureAsync("northstar", sourceId, "demo-owner",
                Request("stale", 1), CancellationToken.None));
        await Assert.ThrowsAsync<ConflictException>(async () =>
            await service.RotateAsync("northstar", sourceId, "demo-owner",
                new ConnectionCredentialRotation("stale", 1), CancellationToken.None));
        await Assert.ThrowsAsync<ConflictException>(async () =>
            await service.RevokeAsync("northstar", sourceId, "demo-owner", 1, CancellationToken.None));
        var profile = (await repository.FindAsync("northstar", sourceId, CancellationToken.None))!;
        Assert.That(await repository.SaveAsync(profile with { OrganizationId = "isolated" },
            2, "demo-owner", "reconfigured", CancellationToken.None), Is.False);
        Assert.That(await repository.DeleteAsync("isolated", sourceId, 2, "other",
            CancellationToken.None), Is.False);
        Assert.That(await repository.FindAsync("isolated", sourceId, CancellationToken.None), Is.Null);
    }

    [Test]
    public async Task RevocationTombstoneRejectsDelayedCreateAndRequiresNewRevisionForReactivation()
    {
        await service.ConfigureAsync("northstar", sourceId, "demo-owner",
            Request("first-credential", 0), CancellationToken.None);
        await service.RevokeAsync("northstar", sourceId, "demo-owner", 1, CancellationToken.None);
        var status = await service.FindAsync("northstar", sourceId, "demo-owner", CancellationToken.None);
        Assert.Multiple(() =>
        {
            Assert.That(status?.Kind, Is.EqualTo("revoked"));
            Assert.That(status?.Revision, Is.EqualTo(2));
            Assert.That(status?.HasCredential, Is.False);
        });
        await Assert.ThrowsAsync<ConflictException>(async () =>
            await service.ConfigureAsync("northstar", sourceId, "demo-owner",
                Request("replayed-original", 0), CancellationToken.None));
        await Assert.ThrowsAsync<ConflictException>(async () =>
            await service.ConfigureAsync("northstar", sourceId, "demo-owner",
                Request("replayed-previous", 1), CancellationToken.None));
        Assert.That(await new ConnectionCredentialReader(repository, protector)
            .ReadAsync("northstar", sourceId, CancellationToken.None), Is.Null);
        var reactivated = await service.ConfigureAsync("northstar", sourceId, "demo-owner",
            Request("new-credential", 2), CancellationToken.None);
        Assert.That(reactivated?.Revision, Is.EqualTo(3));
    }

    [Test]
    public async Task AuditEventsHaveOnlySafeFieldsAndAreAtomicWithMutations()
    {
        await service.ConfigureAsync("northstar", sourceId, "demo-owner",
            Request("highly-sensitive-credential", 0), CancellationToken.None);
        await service.RotateAsync("northstar", sourceId, "demo-owner",
            new ConnectionCredentialRotation("new-credential", 1), CancellationToken.None);
        await service.RevokeAsync("northstar", sourceId, "demo-owner", 2, CancellationToken.None);
        await using var connection = new SqliteConnection($"Data Source={databasePath}");
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT action FROM connection_security_events WHERE organization_id = $org ORDER BY occurred_at";
        command.Parameters.AddWithValue("$org", "northstar");
        var actions = new List<string>();
        await using var results = await command.ExecuteReaderAsync();
        while (await results.ReadAsync()) actions.Add(results.GetString(0));
        Assert.That(actions, Is.EquivalentTo(new[] { "configured", "credential-rotated", "revoked" }));
        var disk = Encoding.UTF8.GetString(await File.ReadAllBytesAsync(databasePath));
        Assert.Multiple(() =>
        {
            Assert.That(disk, Does.Not.Contain("highly-sensitive-credential"));
            Assert.That(disk, Does.Not.Contain("new-credential"));
        });
    }

    [Test]
    public async Task DeletedDataSourceCascadesAwayConnectionProfile()
    {
        await service.ConfigureAsync("northstar", sourceId, "demo-owner",
            Request("to-be-erased", 0), CancellationToken.None);
        await new DataSourceService(definitions, organizations, repository, TimeProvider.System)
            .DeleteAsync("northstar", sourceId, "demo-owner", 1, CancellationToken.None);
        Assert.That(await repository.FindAsync("northstar", sourceId, CancellationToken.None), Is.Null);
    }

    [Test]
    public async Task EditorCannotBypassCredentialRevocationByDeletingRegisteredSource()
    {
        await using (var connection = new SqliteConnection($"Data Source={databasePath}"))
        {
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO memberships(organization_id, user_id, role)
                VALUES ('northstar', 'test-editor', 1)
                """;
            await command.ExecuteNonQueryAsync();
        }
        var registration = new DataSourceService(definitions, organizations, repository, TimeProvider.System);
        var metadataOnly = await registration.CreateAsync("northstar", "test-editor",
            new DataSourceDraft("Metadata", DataSourceProvider.MySql), CancellationToken.None);
        Assert.That(await registration.DeleteAsync("northstar", metadataOnly.Id, "test-editor", 1,
            CancellationToken.None), Is.True);

        await service.ConfigureAsync("northstar", sourceId, "demo-owner",
            Request("owner-credential", 0), CancellationToken.None);
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await registration.DeleteAsync("northstar", sourceId, "test-editor", 1,
                CancellationToken.None));
        // Defense in depth at the atomic SQL boundary covers concurrent profile creation.
        Assert.That(await definitions.DeleteAsync("northstar", sourceId, 1,
            CancellationToken.None, requireUnconfigured: true), Is.False);
        Assert.That(await repository.FindAsync("northstar", sourceId, CancellationToken.None), Is.Not.Null);
        Assert.That(await registration.DeleteAsync("northstar", sourceId, "demo-owner", 1,
            CancellationToken.None), Is.True);
    }

    [Test]
    public async Task IncompatibleShapesAndInvalidCredentialsAreRejected()
    {
        await Assert.ThrowsAsync<InvalidConnectionException>(async () =>
            await service.ConfigureAsync("northstar", sourceId, "demo-owner",
                new ConnectionConfigurationRequest(null, new SqliteConnectionRequest("data"),
                    "secret", 0), CancellationToken.None));
        await Assert.ThrowsAsync<InvalidConnectionException>(async () =>
            await service.ConfigureAsync("northstar", sourceId, "demo-owner",
                Request("\nsecret", 0), CancellationToken.None));
        await Assert.ThrowsAsync<InvalidConnectionException>(async () =>
            await service.ConfigureAsync("northstar", sourceId, "demo-owner",
                Request("secret", 0) with
                {
                    Network = new NetworkConnectionRequest("db.example.com", 0, "analytics", "reader")
                }, CancellationToken.None));
        await Assert.ThrowsAsync<InvalidConnectionException>(async () =>
            await service.ConfigureAsync("northstar", sourceId, "demo-owner",
                Request("secret", 0) with
                {
                    Network = new NetworkConnectionRequest("db.example.com", 5432,
                        "analytics;Password=stolen", "reader")
                }, CancellationToken.None));
    }

    [Test]
    public async Task RotatingCredentialsRejectsDestinationWhoseDnsHasReboundToPrivateSpace()
    {
        var resolver = new ChangingDns();
        var policy = new ApprovedDestinationPolicy(
            new Dictionary<DataSourceProvider, IReadOnlySet<string>>
            {
                [DataSourceProvider.PostgreSql] = new HashSet<string> { "db.example.com:5432" }
            }, resolver);
        var guarded = new ConnectionService(definitions, organizations, repository,
            protector, policy, new MappedSqliteFilePolicy(null,
                new Dictionary<string, string>(), databasePath), TimeProvider.System);
        await guarded.ConfigureAsync("northstar", sourceId, "demo-owner",
            Request("good-credential", 0), CancellationToken.None);
        resolver.Rebound = true;
        await Assert.ThrowsAsync<InvalidConnectionException>(async () =>
            await guarded.RotateAsync("northstar", sourceId, "demo-owner",
                new ConnectionCredentialRotation("rejected-credential", 1), CancellationToken.None));
        Assert.That(await new ConnectionCredentialReader(repository, protector)
            .ReadAsync("northstar", sourceId, CancellationToken.None), Is.EqualTo("good-credential"));
    }

    [Test]
    public async Task SqliteRequiresServerManagedFileIdAndNeverStoresASecretOrPath()
    {
        var folder = Path.Combine(Path.GetTempPath(), $"analytics-files-{Guid.NewGuid():N}");
        Directory.CreateDirectory(folder);
        var file = Path.Combine(folder, "approved.sqlite");
        await File.WriteAllTextAsync(file, "test");
        try
        {
            var sqlite = await new DataSourceService(definitions, organizations, repository, TimeProvider.System)
                .CreateAsync("northstar", "demo-owner",
                    new DataSourceDraft("Local", DataSourceProvider.Sqlite), CancellationToken.None);
            var configured = new ConnectionService(definitions, organizations, repository, protector,
                new ApprovedDestinationPolicy(
                    new Dictionary<DataSourceProvider, IReadOnlySet<string>>(), new PublicDns()),
                new MappedSqliteFilePolicy(folder,
                    new Dictionary<string, string> { ["approved"] = file }, databasePath),
                TimeProvider.System);
            var status = await configured.ConfigureAsync("northstar", sqlite.Id, "demo-owner",
                new ConnectionConfigurationRequest(null, new SqliteConnectionRequest("approved"), null, 0),
                CancellationToken.None);
            var saved = await repository.FindAsync("northstar", sqlite.Id, CancellationToken.None);
            Assert.Multiple(() =>
            {
                Assert.That(status?.HasCredential, Is.False);
                Assert.That(status?.Kind, Is.EqualTo("sqlite"));
                Assert.That(saved?.SqliteFileId, Is.EqualTo("approved"));
                Assert.That(saved?.Secret, Is.Null);
            });
            await Assert.ThrowsAsync<InvalidConnectionException>(async () =>
                await configured.ConfigureAsync("northstar", sqlite.Id, "demo-owner",
                    new ConnectionConfigurationRequest(null, new SqliteConnectionRequest(file), null, 1),
                    CancellationToken.None));
        }
        finally
        {
            Directory.Delete(folder, recursive: true);
        }
    }

    [Test]
    public async Task ElasticsearchRejectsRelationalFieldsAndUsesOnlyApprovedHttpsEndpoint()
    {
        var elastic = await new DataSourceService(definitions, organizations, repository, TimeProvider.System)
            .CreateAsync("northstar", "demo-owner",
                new DataSourceDraft("Search", DataSourceProvider.Elasticsearch), CancellationToken.None);
        var configured = new ConnectionService(definitions, organizations, repository, protector,
            new ApprovedDestinationPolicy(
                new Dictionary<DataSourceProvider, IReadOnlySet<string>>
                {
                    [DataSourceProvider.Elasticsearch] = new HashSet<string> { "search.example.com:443" }
                }, new PublicDns()),
            new MappedSqliteFilePolicy(null, new Dictionary<string, string>(), databasePath),
            TimeProvider.System);
        await Assert.ThrowsAsync<InvalidConnectionException>(async () =>
            await configured.ConfigureAsync("northstar", elastic.Id, "demo-owner",
                new ConnectionConfigurationRequest(new NetworkConnectionRequest(
                    "search.example.com", 443, "index", null), null, "token", 0),
                CancellationToken.None));
        var success = await configured.ConfigureAsync("northstar", elastic.Id, "demo-owner",
            new ConnectionConfigurationRequest(new NetworkConnectionRequest(
                "search.example.com", 443, null, null), null, "api-token", 0),
            CancellationToken.None);
        Assert.That(success?.HasCredential, Is.True);
    }

    private static ConnectionConfigurationRequest Request(string credential, int revision) =>
        new(new NetworkConnectionRequest("DB.Example.Com", 5432, "analytics", "reader"),
            null, credential, revision);
}
