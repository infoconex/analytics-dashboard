using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using AnalyticsDashboard.Infrastructure;
using Microsoft.Data.Sqlite;

namespace AnalyticsDashboard.Tests;

public sealed class DataSourceServiceTests
{
    private string databasePath = null!;
    private SqliteCatalog catalog = null!;
    private SqliteDataSourceRepository repository = null!;
    private DataSourceService service = null!;

    [SetUp]
    public async Task SetUp()
    {
        databasePath = Path.Combine(Path.GetTempPath(), $"analytics-sources-{Guid.NewGuid():N}.db");
        catalog = new SqliteCatalog(databasePath);
        await catalog.InitializeAsync();
        await catalog.SeedDevelopmentAsync();
        repository = new SqliteDataSourceRepository(databasePath);
        await repository.InitializeAsync();
        service = new DataSourceService(repository, catalog, TimeProvider.System);
    }

    [TearDown]
    public void TearDown()
    {
        SqliteConnection.ClearAllPools();
        if (File.Exists(databasePath)) File.Delete(databasePath);
    }

    [TestCase(DataSourceProvider.SqlServer)]
    [TestCase(DataSourceProvider.MySql)]
    [TestCase(DataSourceProvider.PostgreSql)]
    [TestCase(DataSourceProvider.Sqlite)]
    [TestCase(DataSourceProvider.Elasticsearch)]
    public async Task AllProvidersCanBeRegisteredAndPersistAcrossRepositoryRestart(DataSourceProvider provider)
    {
        var created = await service.CreateAsync("northstar", "demo-owner",
            new DataSourceDraft("  Revenue reporting  ", provider), CancellationToken.None);
        var reopened = new SqliteDataSourceRepository(databasePath);
        await reopened.InitializeAsync();
        var saved = await reopened.FindAsync("northstar", created.Id, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(saved?.OrganizationId, Is.EqualTo("northstar"));
            Assert.That(saved?.Provider, Is.EqualTo(provider));
            Assert.That(saved?.Name, Is.EqualTo("Revenue reporting"));
            Assert.That(saved?.Revision, Is.EqualTo(1));
            Assert.That(saved?.CreatedBy, Is.EqualTo("demo-owner"));
            Assert.That(saved?.CreatedAt, Is.EqualTo(created.CreatedAt));
            Assert.That(saved?.UpdatedAt, Is.EqualTo(created.UpdatedAt));
        });
    }

    [Test]
    public async Task TenantIsolationAppliesToEveryOperationIncludingGuessedIds()
    {
        var source = await service.CreateAsync("northstar", "demo-owner",
            new DataSourceDraft("Private", DataSourceProvider.Sqlite), CancellationToken.None);

        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.ListAsync("northstar", "another-user", CancellationToken.None));
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.FindAsync("northstar", source.Id, "another-user", CancellationToken.None));
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.UpdateAsync("northstar", source.Id, "another-user",
                new DataSourceUpdate("Stolen", 1), CancellationToken.None));
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.DeleteAsync("northstar", source.Id, "another-user", 1, CancellationToken.None));

        Assert.That(await repository.FindAsync("isolated", source.Id, CancellationToken.None), Is.Null);
        Assert.That(await repository.DeleteAsync("isolated", source.Id, 1, CancellationToken.None), Is.False);
        Assert.That(await repository.ReplaceAsync(source with { OrganizationId = "isolated" }, 1,
            CancellationToken.None), Is.False);
    }

    [Test]
    public async Task ViewerCanReadButCannotMutateMetadata()
    {
        var source = await service.CreateAsync("northstar", "demo-owner",
            new DataSourceDraft("Read-only", DataSourceProvider.MySql), CancellationToken.None);

        Assert.That((await service.ListAsync("northstar", "demo-viewer", CancellationToken.None)),
            Has.Count.EqualTo(1));
        Assert.That(await service.FindAsync("northstar", source.Id, "demo-viewer", CancellationToken.None),
            Is.Not.Null);
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.CreateAsync("northstar", "demo-viewer",
                new DataSourceDraft("Denied", DataSourceProvider.MySql), CancellationToken.None));
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.UpdateAsync("northstar", source.Id, "demo-viewer",
                new DataSourceUpdate("Denied", 1), CancellationToken.None));
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.DeleteAsync("northstar", source.Id, "demo-viewer", 1, CancellationToken.None));
    }

    [Test]
    public async Task EditorCanManageDefinitions()
    {
        await using (var connection = new SqliteConnection(new SqliteConnectionStringBuilder
        {
            DataSource = databasePath
        }.ToString()))
        {
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = "INSERT INTO memberships (organization_id, user_id, role) VALUES ($org, $user, $role)";
            command.Parameters.AddWithValue("$org", "northstar");
            command.Parameters.AddWithValue("$user", "test-editor");
            command.Parameters.AddWithValue("$role", (int)OrganizationRole.Editor);
            await command.ExecuteNonQueryAsync();
        }

        var created = await service.CreateAsync("northstar", "test-editor",
            new DataSourceDraft("Operational", DataSourceProvider.PostgreSql), CancellationToken.None);
        var renamed = await service.UpdateAsync("northstar", created.Id, "test-editor",
            new DataSourceUpdate("Finance", 1), CancellationToken.None);
        var removed = await service.DeleteAsync("northstar", created.Id, "test-editor", 2, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(renamed?.Name, Is.EqualTo("Finance"));
            Assert.That(renamed?.Provider, Is.EqualTo(DataSourceProvider.PostgreSql));
            Assert.That(removed, Is.True);
        });
    }

    [Test]
    public async Task RevisionsPreventStaleRenamesAndDeletes()
    {
        var source = await service.CreateAsync("northstar", "demo-owner",
            new DataSourceDraft("Original", DataSourceProvider.SqlServer), CancellationToken.None);
        var renamed = await service.UpdateAsync("northstar", source.Id, "demo-owner",
            new DataSourceUpdate("Latest", 1), CancellationToken.None);

        Assert.That(renamed?.Revision, Is.EqualTo(2));
        await Assert.ThrowsAsync<ConflictException>(async () =>
            await service.UpdateAsync("northstar", source.Id, "demo-owner",
                new DataSourceUpdate("Stale", 1), CancellationToken.None));
        await Assert.ThrowsAsync<ConflictException>(async () =>
            await service.DeleteAsync("northstar", source.Id, "demo-owner", 1, CancellationToken.None));
        Assert.That((await repository.FindAsync("northstar", source.Id, CancellationToken.None))?.Name,
            Is.EqualTo("Latest"));
        Assert.That(await service.DeleteAsync("northstar", source.Id, "demo-owner", 2,
            CancellationToken.None), Is.True);
    }

    [Test]
    public async Task DatabaseCompareAndSwapRejectsRaceAgainstStaleRevision()
    {
        var source = await service.CreateAsync("northstar", "demo-owner",
            new DataSourceDraft("Original", DataSourceProvider.SqlServer), CancellationToken.None);
        var next = source with { Name = "First writer", Revision = 2 };
        var stale = source with { Name = "Second writer", Revision = 2 };

        Assert.That(await repository.ReplaceAsync(next, 1, CancellationToken.None), Is.True);
        Assert.That(await repository.ReplaceAsync(stale, 1, CancellationToken.None), Is.False);
        Assert.That(await repository.DeleteAsync("northstar", source.Id, 1, CancellationToken.None), Is.False);
        Assert.That((await repository.FindAsync("northstar", source.Id, CancellationToken.None))?.Name,
            Is.EqualTo("First writer"));
    }

    [Test]
    public async Task InvalidNamesAndProvidersAreRejected()
    {
        foreach (var name in new[] { "", "   ", new string('x', 101), "bad\nname" })
            await Assert.ThrowsAsync<InvalidDataSourceException>(async () =>
                await service.CreateAsync("northstar", "demo-owner",
                    new DataSourceDraft(name, DataSourceProvider.SqlServer), CancellationToken.None));
        await Assert.ThrowsAsync<InvalidDataSourceException>(async () =>
            await service.CreateAsync("northstar", "demo-owner",
                new DataSourceDraft("Unknown", (DataSourceProvider)999), CancellationToken.None));
    }
}
