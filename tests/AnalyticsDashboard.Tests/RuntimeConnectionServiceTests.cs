using System.Data.Common;
using System.Net;
using System.Security.Cryptography;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using AnalyticsDashboard.Infrastructure;
using Microsoft.Data.Sqlite;

namespace AnalyticsDashboard.Tests;

public sealed class RuntimeConnectionServiceTests
{
    private sealed class ChangingDns : IDnsResolver
    {
        public IPAddress[] Addresses { get; set; } = [IPAddress.Parse("8.8.8.8")];
        public int Calls { get; private set; }
        public Func<Task>? BeforeReturn { get; set; }

        public async Task<IPAddress[]> ResolveAsync(string host, CancellationToken token)
        {
            Calls++;
            if (BeforeReturn is not null) await BeforeReturn();
            token.ThrowIfCancellationRequested();
            return Addresses;
        }
    }

    private sealed class RecordingTransport : IRuntimeRelationalTransport
    {
        public bool Ready { get; set; }
        public int ReadinessChecks { get; private set; }
        public int Opens { get; private set; }
        public RuntimeRelationalConnection? LastRequest { get; private set; }
        public string? LastCredential { get; private set; }
        public SqliteConnection? LastSession { get; private set; }
        public Func<Task>? BeforeReturn { get; set; }
        public bool FailOpen { get; set; }

        public Task EnsureReadyAsync(CancellationToken token)
        {
            ReadinessChecks++;
            token.ThrowIfCancellationRequested();
            if (!Ready) throw new ConnectionSecurityUnavailableException();
            return Task.CompletedTask;
        }

        public async Task<DbConnection> OpenAsync(RuntimeRelationalConnection request,
            string credential, CancellationToken token)
        {
            Opens++;
            LastRequest = request;
            LastCredential = credential;
            token.ThrowIfCancellationRequested();
            if (FailOpen) throw new InvalidOperationException("provider exception");
            LastSession = new SqliteConnection("Data Source=:memory:");
            await LastSession.OpenAsync(token);
            if (BeforeReturn is not null) await BeforeReturn();
            return LastSession;
        }
    }

    private sealed class TrackingSecretProtector(IConnectionSecretProtector inner)
        : IConnectionSecretProtector
    {
        public int Reads { get; private set; }

        public ProtectedConnectionSecret Protect(string value, string organizationId,
            Guid dataSourceId, DataSourceProvider provider) =>
            inner.Protect(value, organizationId, dataSourceId, provider);

        public string Unprotect(ProtectedConnectionSecret value, string organizationId,
            Guid dataSourceId, DataSourceProvider provider)
        {
            Reads++;
            return inner.Unprotect(value, organizationId, dataSourceId, provider);
        }
    }

    private sealed class RevocableMembership(IOrganizationCatalog inner) : IOrganizationCatalog
    {
        public bool Active { get; set; } = true;

        public Task<IReadOnlyList<(Organization Organization, OrganizationRole Role)>>
            GetOrganizationsAsync(string userId, CancellationToken token) =>
            inner.GetOrganizationsAsync(userId, token);

        public Task<OrganizationRole?> GetRoleAsync(string organizationId, string userId,
            CancellationToken token) => Active
                ? inner.GetRoleAsync(organizationId, userId, token)
                : Task.FromResult<OrganizationRole?>(null);
    }

    private string path = null!;
    private SqliteCatalog organizations = null!;
    private SqliteDataSourceRepository sources = null!;
    private SqliteConnectionRepository profiles = null!;
    private ConnectionService configuration = null!;
    private ChangingDns dns = null!;
    private RecordingTransport transport = null!;
    private TrackingSecretProtector secrets = null!;
    private IConnectionDestinationPolicy destinations = null!;
    private RuntimeConnectionService runtime = null!;
    private Guid sourceId;

    [SetUp]
    public async Task SetUp()
    {
        path = Path.Combine(Path.GetTempPath(), $"runtime-admission-{Guid.NewGuid():N}.db");
        organizations = new SqliteCatalog(path);
        await organizations.InitializeAsync();
        await organizations.SeedDevelopmentAsync();
        sources = new SqliteDataSourceRepository(path);
        await sources.InitializeAsync();
        profiles = new SqliteConnectionRepository(path);
        await profiles.InitializeAsync();
        dns = new ChangingDns();
        destinations = new ApprovedDestinationPolicy(
            new Dictionary<DataSourceProvider, IReadOnlySet<string>>
            {
                [DataSourceProvider.PostgreSql] = new HashSet<string> { "db.example.com:5432" }
            }, dns);
        var protector = new AesGcmConnectionSecretProtector("test-key",
            new Dictionary<string, string>
            {
                ["test-key"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            });
        secrets = new TrackingSecretProtector(protector);
        configuration = new ConnectionService(sources, organizations, profiles, protector,
            destinations, new MappedSqliteFilePolicy(null, new Dictionary<string, string>(), path),
            TimeProvider.System);
        var source = await new DataSourceService(sources, organizations, profiles, TimeProvider.System)
            .CreateAsync("northstar", "demo-owner",
                new DataSourceDraft("Reporting", DataSourceProvider.PostgreSql), CancellationToken.None);
        sourceId = source.Id;
        await configuration.ConfigureAsync("northstar", sourceId, "demo-owner",
            new ConnectionConfigurationRequest(
                new NetworkConnectionRequest("db.example.com", 5432, "analytics", "reader"),
                null, "secret-test-only", 0), CancellationToken.None);
        transport = new RecordingTransport();
        runtime = NewRuntime();
    }

    [TearDown]
    public void TearDown()
    {
        transport.LastSession?.Dispose();
        SqliteConnection.ClearAllPools();
        if (File.Exists(path)) File.Delete(path);
    }

    private RuntimeConnectionService NewRuntime(IConnectionSecretProtector? protector = null,
        IOrganizationCatalog? membership = null) =>
        new(membership ?? organizations, sources, profiles, destinations, protector ?? secrets, transport);

    private Task<DbConnection?> OpenAsync(string organization = "northstar",
        string user = "demo-owner", Guid? id = null, CancellationToken token = default) =>
        runtime.OpenAsync(organization, id ?? sourceId, user, token);

    [Test]
    public async Task UnauthorizedTenantAndUnknownIdentityAreRejectedBeforeNetworkOrSecrets()
    {
        foreach (var (organization, user) in new[]
                 {
                     ("isolated", "demo-owner"), ("northstar", "not-a-member")
                 })
        {
            await Assert.ThrowsAsync<ForbiddenException>(async () =>
                await OpenAsync(organization, user));
        }
        Assert.Multiple(() =>
        {
            Assert.That(transport.ReadinessChecks, Is.Zero);
            Assert.That(dns.Calls, Is.EqualTo(1)); // Only configuration-time lookup.
            Assert.That(secrets.Reads, Is.Zero);
        });
    }

    [Test]
    public async Task MissingSourceAndMissingProfileNeverReachTransport()
    {
        Assert.That(await OpenAsync(id: Guid.NewGuid()), Is.Null);
        var other = await new DataSourceService(sources, organizations, profiles, TimeProvider.System)
            .CreateAsync("northstar", "demo-owner",
                new DataSourceDraft("Unconfigured", DataSourceProvider.SqlServer), CancellationToken.None);
        await Assert.ThrowsAsync<InvalidConnectionException>(async () =>
            await OpenAsync(id: other.Id));
        Assert.That(transport.ReadinessChecks, Is.Zero);
        Assert.That(secrets.Reads, Is.Zero);
    }

    [Test]
    public async Task CorruptStoredPrincipalIsRejectedBeforeTransportOrKeyAccess()
    {
        await using var connection = new SqliteConnection($"Data Source={path}");
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "UPDATE connection_profiles SET username = NULL WHERE organization_id = $org";
        command.Parameters.AddWithValue("$org", "northstar");
        Assert.That(await command.ExecuteNonQueryAsync(), Is.EqualTo(1));

        transport.Ready = true;
        await Assert.ThrowsAsync<InvalidConnectionException>(async () => await OpenAsync());
        Assert.That(transport.ReadinessChecks, Is.Zero);
        Assert.That(secrets.Reads, Is.Zero);
    }

    [Test]
    public async Task ProductionTransportAlwaysDeniesEvenIfCredentialsAreConfigured()
    {
        runtime = new RuntimeConnectionService(organizations, sources, profiles, destinations,
            secrets, new UnavailableRuntimeRelationalTransport());
        await Assert.ThrowsAsync<ConnectionSecurityUnavailableException>(async () =>
            await OpenAsync());
        Assert.That(dns.Calls, Is.EqualTo(1));
        Assert.That(secrets.Reads, Is.Zero);
    }

    [Test]
    public async Task ReadinessDenialPrecedesFreshDnsAndSecretRetrieval()
    {
        await Assert.ThrowsAsync<ConnectionSecurityUnavailableException>(async () =>
            await OpenAsync());
        Assert.Multiple(() =>
        {
            Assert.That(transport.ReadinessChecks, Is.EqualTo(1));
            Assert.That(transport.Opens, Is.Zero);
            Assert.That(dns.Calls, Is.EqualTo(1));
            Assert.That(secrets.Reads, Is.Zero);
        });
    }

    [Test]
    public async Task EachAttemptUsesFreshApprovedDnsAndTenantBoundCredential()
    {
        transport.Ready = true;
        await using (var first = await OpenAsync())
        {
            Assert.That(first, Is.Not.Null);
            Assert.That(transport.LastRequest?.Destination.Addresses.Single().ToString(), Is.EqualTo("8.8.8.8"));
            Assert.That(transport.LastRequest?.Destination.Host, Is.EqualTo("db.example.com"));
            Assert.That(transport.LastRequest?.Provider, Is.EqualTo(DataSourceProvider.PostgreSql));
            Assert.That(transport.LastCredential, Is.EqualTo("secret-test-only"));
        }
        dns.Addresses = [IPAddress.Parse("1.1.1.1")];
        await using (var second = await OpenAsync())
        {
            Assert.That(second, Is.Not.Null);
            Assert.That(transport.LastRequest?.Destination.Addresses.Single().ToString(), Is.EqualTo("1.1.1.1"));
        }
        Assert.Multiple(() =>
        {
            Assert.That(dns.Calls, Is.EqualTo(3));
            Assert.That(transport.Opens, Is.EqualTo(2));
            Assert.That(secrets.Reads, Is.EqualTo(2));
        });
    }

    [TestCase("169.254.169.254")]
    [TestCase("127.0.0.1")]
    [TestCase("10.1.2.3")]
    [TestCase("203.0.113.1")]
    public async Task ReboundToForbiddenAddressCannotGetSecretOrOpen(string address)
    {
        transport.Ready = true;
        dns.Addresses = [IPAddress.Parse(address)];
        await Assert.ThrowsAsync<InvalidConnectionException>(async () => await OpenAsync());
        Assert.That(transport.Opens, Is.Zero);
        Assert.That(secrets.Reads, Is.Zero);
    }

    [Test]
    public async Task MixedDnsAnswersAndEmptyDnsAnswersAreRejected()
    {
        transport.Ready = true;
        foreach (var addresses in new[]
                 {
                     new[] { IPAddress.Parse("8.8.8.8"), IPAddress.Parse("192.168.1.10") },
                     Array.Empty<IPAddress>()
                 })
        {
            dns.Addresses = addresses;
            await Assert.ThrowsAsync<InvalidConnectionException>(async () => await OpenAsync());
        }
        Assert.That(secrets.Reads, Is.Zero);
        Assert.That(transport.Opens, Is.Zero);
    }

    [Test]
    public async Task ChangedOperatorAllowlistDeniesWithoutResolvingOrReadingSecret()
    {
        transport.Ready = true;
        destinations = new ApprovedDestinationPolicy(
            new Dictionary<DataSourceProvider, IReadOnlySet<string>>(), dns);
        runtime = NewRuntime();
        await Assert.ThrowsAsync<InvalidConnectionException>(async () => await OpenAsync());
        Assert.That(dns.Calls, Is.EqualTo(1));
        Assert.That(secrets.Reads, Is.Zero);
        Assert.That(transport.Opens, Is.Zero);
    }

    [Test]
    public async Task RevokedProfileNeverPermitsAdmission()
    {
        await configuration.RevokeAsync("northstar", sourceId, "demo-owner", 1,
            CancellationToken.None);
        transport.Ready = true;
        await Assert.ThrowsAsync<InvalidConnectionException>(async () => await OpenAsync());
        Assert.That(transport.ReadinessChecks, Is.Zero);
        Assert.That(secrets.Reads, Is.Zero);
    }

    [Test]
    public async Task MissingHistoricalEncryptionKeyDeniesSessionBeforeProviderOpening()
    {
        transport.Ready = true;
        runtime = NewRuntime(new AesGcmConnectionSecretProtector(null,
            new Dictionary<string, string>()));
        await Assert.ThrowsAsync<ConnectionSecurityUnavailableException>(async () => await OpenAsync());
        Assert.That(transport.Opens, Is.Zero);
    }

    [Test]
    public async Task RevocationDuringNetworkValidationDeniesBeforeKeyAccess()
    {
        transport.Ready = true;
        dns.BeforeReturn = async () =>
            await configuration.RevokeAsync("northstar", sourceId, "demo-owner", 1,
                CancellationToken.None);
        await Assert.ThrowsAsync<ConflictException>(async () => await OpenAsync());
        Assert.That(transport.Opens, Is.Zero);
        Assert.That(secrets.Reads, Is.Zero);
    }

    [Test]
    public async Task MembershipRevocationDuringDnsDeniesBeforeKeyAccess()
    {
        var roles = new RevocableMembership(organizations);
        runtime = NewRuntime(membership: roles);
        transport.Ready = true;
        dns.BeforeReturn = () =>
        {
            roles.Active = false;
            return Task.CompletedTask;
        };
        await Assert.ThrowsAsync<ForbiddenException>(async () => await OpenAsync());
        Assert.That(secrets.Reads, Is.Zero);
        Assert.That(transport.Opens, Is.Zero);
    }

    [Test]
    public async Task MembershipRevocationDuringOpenDisposesSession()
    {
        var roles = new RevocableMembership(organizations);
        runtime = NewRuntime(membership: roles);
        transport.Ready = true;
        transport.BeforeReturn = () =>
        {
            roles.Active = false;
            return Task.CompletedTask;
        };
        await Assert.ThrowsAsync<ForbiddenException>(async () => await OpenAsync());
        Assert.That(transport.LastSession?.State, Is.EqualTo(System.Data.ConnectionState.Closed));
    }

    [Test]
    public async Task RevocationDuringTransportOpeningDisposesTheSession()
    {
        transport.Ready = true;
        transport.BeforeReturn = async () =>
            await configuration.RevokeAsync("northstar", sourceId, "demo-owner", 1,
                CancellationToken.None);
        await Assert.ThrowsAsync<ConflictException>(async () => await OpenAsync());
        Assert.That(transport.LastSession?.State, Is.EqualTo(System.Data.ConnectionState.Closed));
    }

    [Test]
    public async Task ProviderErrorsAreSanitizedAndNeverIncludeCredentials()
    {
        transport.Ready = true;
        transport.FailOpen = true;
        var exception = await Assert.ThrowsAsync<ConnectionSecurityUnavailableException>(async () =>
            await OpenAsync());
        Assert.That(exception?.Message, Does.Not.Contain("secret-test-only"));
    }

    [Test]
    public async Task PreCancelledRequestNeverProbesMembershipOrTransport()
    {
        using var source = new CancellationTokenSource();
        await source.CancelAsync();
        await Assert.ThrowsAsync<OperationCanceledException>(async () =>
            await OpenAsync(token: source.Token));
        Assert.That(transport.ReadinessChecks, Is.Zero);
        Assert.That(secrets.Reads, Is.Zero);
    }
}
