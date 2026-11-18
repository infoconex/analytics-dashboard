using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using AnalyticsDashboard.Infrastructure;

namespace AnalyticsDashboard.Tests;

public sealed class DashboardServiceTests
{
    private string databasePath = null!;
    private SqliteCatalog catalog = null!;
    private DashboardService service = null!;

    [SetUp]
    public async Task SetUp()
    {
        databasePath = Path.Combine(Path.GetTempPath(), $"analytics-tests-{Guid.NewGuid():N}.db");
        catalog = new SqliteCatalog(databasePath);
        await catalog.InitializeAsync();
        await catalog.SeedDevelopmentAsync();
        service = new DashboardService(catalog, catalog, TimeProvider.System);
    }

    [TearDown]
    public void TearDown()
    {
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        if (File.Exists(databasePath)) File.Delete(databasePath);
    }

    [Test]
    public async Task UserWithoutMembershipCannotReadOtherOrganizationsDashboards()
    {
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.ListAsync("isolated", "demo-owner", CancellationToken.None));
    }

    [Test]
    public async Task ViewerCannotModifyDashboards()
    {
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.CreateAsync("northstar", "demo-viewer", Draft(), CancellationToken.None));
    }

    [Test]
    public async Task OrganizationIdsAlwaysScopeDashboardLookups()
    {
        var actual = (await service.ListAsync("northstar", "demo-owner", CancellationToken.None))[0];
        var other = await catalog.FindAsync("isolated", actual.Id, CancellationToken.None);
        Assert.That(other, Is.Null);
    }

    [Test]
    public async Task UpdateRejectsStaleRevisionWithoutOverwritingChanges()
    {
        var saved = await service.CreateAsync("northstar", "demo-owner", Draft(), CancellationToken.None);
        var updated = await service.UpdateAsync("northstar", saved.Id, "demo-owner",
            Draft() with { Name = "Current" }, saved.Revision, CancellationToken.None);

        Assert.That(updated, Is.Not.Null);
        Assert.That(updated!.Revision, Is.EqualTo(2));
        await Assert.ThrowsAsync<ConflictException>(async () =>
            await service.UpdateAsync("northstar", saved.Id, "demo-owner",
                Draft() with { Name = "Stale" }, 1, CancellationToken.None));

        var persisted = await service.FindAsync("northstar", saved.Id, "demo-owner", CancellationToken.None);
        Assert.That(persisted?.Name, Is.EqualTo("Current"));
    }

    [Test]
    public async Task DashboardsSurviveCatalogRecreation()
    {
        var created = await service.CreateAsync("northstar", "demo-owner", Draft(), CancellationToken.None);
        var reopened = new SqliteCatalog(databasePath);
        await reopened.InitializeAsync();
        var persisted = await reopened.FindAsync("northstar", created.Id, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(persisted?.Name, Is.EqualTo("Test dashboard"));
            Assert.That(persisted?.Widgets, Has.Count.EqualTo(1));
            Assert.That(persisted?.Revision, Is.EqualTo(1));
        });
    }

    [Test]
    public async Task ExpandedVisualizationDefinitionsRoundTripWithoutChangingExistingEnumValues()
    {
        Assert.Multiple(() =>
        {
            Assert.That((int)VisualizationKind.Metric, Is.EqualTo(0));
            Assert.That((int)VisualizationKind.Table, Is.EqualTo(5));
            Assert.That((int)VisualizationKind.Pie, Is.EqualTo(6));
            Assert.That((int)VisualizationKind.Histogram, Is.EqualTo(7));
            Assert.That((int)VisualizationKind.Scatter, Is.EqualTo(8));
        });

        var expanded = new DashboardDraft("Fictional visualizations", "Sample-only", [
            new DashboardWidget(Guid.NewGuid(), "Channel share", VisualizationKind.Pie, "channels", "orders", "channel"),
            new DashboardWidget(Guid.NewGuid(), "Revenue distribution", VisualizationKind.Histogram, "commerce", "revenue", "month"),
            new DashboardWidget(Guid.NewGuid(), "Orders compared", VisualizationKind.Scatter, "commerce", "orders", "revenue")
        ]);
        var saved = await service.CreateAsync("northstar", "demo-owner", expanded, CancellationToken.None);
        var reopened = new SqliteCatalog(databasePath);
        await reopened.InitializeAsync();
        var persisted = await reopened.FindAsync("northstar", saved.Id, CancellationToken.None);

        Assert.That(persisted?.Widgets.Select(widget => widget.Kind), Is.EqualTo(new[] {
            VisualizationKind.Pie, VisualizationKind.Histogram, VisualizationKind.Scatter
        }));
    }

    [Test]
    public async Task DuplicateWidgetIdsAreRejected()
    {
        var widget = Draft().Widgets[0];
        var invalid = new DashboardDraft("Invalid", "", [widget, widget]);
        await Assert.ThrowsAsync<InvalidDashboardException>(async () =>
            await service.CreateAsync("northstar", "demo-owner", invalid, CancellationToken.None));
    }

    [Test]
    public async Task NullDashboardDefinitionIsRejected()
    {
        await Assert.ThrowsAsync<InvalidDashboardException>(async () =>
            await service.CreateAsync("northstar", "demo-owner", null!, CancellationToken.None));
    }

    [Test]
    public async Task NullWidgetIsRejected()
    {
        var invalid = Draft() with { Widgets = [null!] };
        await Assert.ThrowsAsync<InvalidDashboardException>(async () =>
            await service.CreateAsync("northstar", "demo-owner", invalid, CancellationToken.None));
    }

    [Test]
    public async Task ViewerCannotUpdateOrDeleteDashboard()
    {
        var dashboard = (await service.ListAsync("northstar", "demo-owner", CancellationToken.None))[0];

        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.UpdateAsync("northstar", dashboard.Id, "demo-viewer",
                Draft(), dashboard.Revision, CancellationToken.None));
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.DeleteAsync("northstar", dashboard.Id, "demo-viewer", CancellationToken.None));

        Assert.That(await service.FindAsync("northstar", dashboard.Id, "demo-owner", CancellationToken.None),
            Is.Not.Null);
    }

    private static DashboardDraft Draft() => new("Test dashboard", "Testing persistent views", [
        new DashboardWidget(Guid.NewGuid(), "Revenue", VisualizationKind.Area,
            "commerce", "revenue", "month")
    ]);
}
