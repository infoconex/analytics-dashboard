using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using AnalyticsDashboard.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace AnalyticsDashboard.Tests;

public sealed class SavedVisualizationTests
{
    private string databasePath = null!;
    private SqliteCatalog catalog = null!;
    private SavedVisualizationService service = null!;
    private static readonly CancellationToken Token = CancellationToken.None;
    private static readonly JsonSerializerOptions ApiJson = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    [SetUp]
    public async Task SetUp()
    {
        databasePath = Path.Combine(Path.GetTempPath(), $"visualization-{Guid.NewGuid():N}.db");
        catalog = new SqliteCatalog(databasePath);
        await catalog.InitializeAsync();
        await catalog.SeedDevelopmentAsync();
        service = new SavedVisualizationService(catalog, catalog, TimeProvider.System);
    }

    [TearDown]
    public void TearDown()
    {
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        if (File.Exists(databasePath)) File.Delete(databasePath);
    }

    private static SavedVisualizationDraft Draft(VisualizationAppearance? appearance = null) =>
        new("Original fictional channel orders",
            new DashboardWidget(Guid.NewGuid(), "Orders by channel", VisualizationKind.Pie,
                "channels", "orders", "channel", 9, 420, appearance));

    [Test]
    public async Task SnapshotPersistsAcrossCatalogRecreationWithoutDashboardGeometry()
    {
        var appearance = new VisualizationAppearance(ShowLegend: false, ShowSliceLabels: true,
            MaxSliceLabels: 8, CategorySort: "valueAsc");
        var saved = await service.CreateAsync("northstar", "demo-owner", Draft(appearance), Token);
        var reopened = new SqliteCatalog(databasePath);
        await reopened.InitializeAsync();
        var found = await reopened.FindVisualizationAsync("northstar", saved.Id, Token);
        Assert.Multiple(() =>
        {
            Assert.That(found?.OrganizationId, Is.EqualTo("northstar"));
            Assert.That(found?.Definition.Kind, Is.EqualTo(VisualizationKind.Pie));
            Assert.That(found?.Definition.Appearance?.CategorySort, Is.EqualTo("valueAsc"));
            Assert.That(found?.Definition.Appearance?.ShowSliceLabels, Is.True);
            Assert.That(found?.Definition.Appearance?.MaxSliceLabels, Is.EqualTo(8));
            Assert.That(found?.Definition.Columns, Is.Null);
            Assert.That(found?.Definition.Height, Is.Null);
            Assert.That(found?.Revision, Is.EqualTo(1));
        });
    }

    [Test]
    public async Task LibraryIsOrganizationScopedAndNeverAffectsExistingDashboardSnapshots()
    {
        var oldDashboard = (await catalog.ListAsync("northstar", Token))[0];
        var original = oldDashboard.Widgets[2];
        var saved = await service.CreateAsync("northstar", "demo-owner",
            new("Snapshot", original), Token);
        Assert.That(await catalog.FindVisualizationAsync("isolated", saved.Id, Token), Is.Null);
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.ListAsync("isolated", "demo-owner", Token));
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.FindAsync("isolated", saved.Id, "demo-owner", Token));
        var edited = await service.UpdateAsync("northstar", saved.Id, "demo-owner",
            new("Updated template", saved.Definition with { Title = "Changed template" }), 1, Token);
        var persistedDashboard = await catalog.FindAsync("northstar", oldDashboard.Id, Token);
        Assert.Multiple(() =>
        {
            Assert.That(edited?.Definition.Title, Is.EqualTo("Changed template"));
            Assert.That(persistedDashboard?.Widgets[2].Title, Is.EqualTo(original.Title));
        });
    }

    [Test]
    public async Task ViewerCanReadButCannotMutateAndCrossTenantMutationsAreForbidden()
    {
        var saved = await service.CreateAsync("northstar", "demo-owner", Draft(), Token);
        var visible = await service.ListAsync("northstar", "demo-viewer", Token);
        Assert.That(visible.Any(item => item.Id == saved.Id), Is.True);
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.CreateAsync("northstar", "demo-viewer", Draft(), Token));
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.UpdateAsync("northstar", saved.Id, "demo-viewer", Draft(), 1, Token));
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.DeleteAsync("northstar", saved.Id, "demo-viewer", 1, Token));
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.DeleteAsync("isolated", saved.Id, "demo-owner", 1, Token));
    }

    [Test]
    public async Task RevisionConflictNeverOverwritesSavedConfiguration()
    {
        var saved = await service.CreateAsync("northstar", "demo-owner", Draft(), Token);
        var updated = await service.UpdateAsync("northstar", saved.Id, "demo-owner",
            Draft(new VisualizationAppearance(ShowLegend: false)), 1, Token);
        Assert.That(updated?.Revision, Is.EqualTo(2));
        await Assert.ThrowsAsync<ConflictException>(async () =>
            await service.UpdateAsync("northstar", saved.Id, "demo-owner", Draft(), 1, Token));
        await Assert.ThrowsAsync<ConflictException>(async () =>
            await service.DeleteAsync("northstar", saved.Id, "demo-owner", 1, Token));
        Assert.That((await service.FindAsync("northstar", saved.Id, "demo-owner", Token))?.Definition.Appearance?.ShowLegend, Is.False);
        Assert.That(await service.DeleteAsync("northstar", saved.Id, "demo-owner", 2, Token), Is.True);
        Assert.That(await service.FindAsync("northstar", saved.Id, "demo-owner", Token), Is.Null);
    }

    [Test]
    public void RejectsInvalidTemplateFieldsAndMisleadingSampleAggregations()
    {
        var invalid = new[]
        {
            Draft() with { Definition = Draft().Definition with { DatasetKey = "unknown" } },
            Draft() with { Definition = Draft().Definition with { Kind = VisualizationKind.Donut, MetricKey = "conversion" } },
            Draft() with { Definition = Draft().Definition with { Appearance = new VisualizationAppearance(HistogramBins: 99) } },
            Draft() with { Definition = Draft().Definition with { Kind = VisualizationKind.Scatter, DimensionKey = "orders" } },
            Draft() with { Definition = Draft().Definition with { Title = new string('a', 101) } },
            Draft() with { Description = new string('a', 501) }
        };
        foreach (var item in invalid)
            Assert.ThrowsAsync<InvalidDashboardException>(async () =>
                await service.CreateAsync("northstar", "demo-owner", item, Token));
    }

    private static SavedVisualizationDraft QueryDraft() => new("Fictional raw records",
        new DashboardWidget(Guid.NewGuid(), "Sales by status", VisualizationKind.Bar,
            "fictionalQuery", "query", "query", QueryDefinition:
            new FictionalQueryDefinition("sales", "bar", "order_status", "sum", "amount")));

    [Test]
    public async Task QueryDefinitionPersistsInBothSnapshotsAndHonorsRevisions()
    {
        var draft = QueryDraft();
        var saved = await service.CreateAsync("northstar", "demo-owner", draft, Token);
        var dashboards = new DashboardService(catalog, catalog, TimeProvider.System);
        var copy = saved.Definition with { Id = Guid.NewGuid() };
        var dashboard = await dashboards.CreateAsync("northstar", "demo-owner",
            new DashboardDraft("Fictional query dashboard", "", [copy]), Token);
        var changed = saved.Definition with { QueryDefinition = saved.Definition.QueryDefinition! with
            { Aggregate = "count", MeasureDimension = null } };
        await service.UpdateAsync("northstar", saved.Id, "demo-owner", new("", changed), 1, Token);
        await Assert.ThrowsAsync<ConflictException>(async () =>
            await service.UpdateAsync("northstar", saved.Id, "demo-owner", draft, 1, Token));
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await service.CreateAsync("northstar", "demo-viewer", draft, Token));
        var reopened = new SqliteCatalog(databasePath);
        await reopened.InitializeAsync();
        var found = await reopened.FindVisualizationAsync("northstar", saved.Id, Token);
        var persisted = await reopened.FindAsync("northstar", dashboard.Id, Token);
        Assert.Multiple(() =>
        {
            Assert.That(found?.Definition.QueryDefinition, Is.EqualTo(changed.QueryDefinition));
            Assert.That(persisted?.Widgets.Single().QueryDefinition, Is.EqualTo(copy.QueryDefinition));
            Assert.That(found?.Revision, Is.EqualTo(2));
        });
        Assert.That(await reopened.FindVisualizationAsync("isolated", saved.Id, Token), Is.Null);
    }

    [Test]
    public void BothWritePathsRejectUnsupportedOrMixedQueryDefinitions()
    {
        var valid = QueryDraft().Definition;
        var query = valid.QueryDefinition!;
        var invalid = new[]
        {
            valid with { QueryDefinition = null },
            valid with { DatasetKey = "commerce" },
            valid with { Kind = VisualizationKind.Pie },
            valid with { QueryDefinition = query with { Dataset = "unknown" } },
            valid with { QueryDefinition = query with { GroupByDimension = "CustomerId" } },
            valid with { QueryDefinition = query with { Aggregate = "average" } },
            valid with { QueryDefinition = query with { Aggregate = "count" } },
            valid with { QueryDefinition = query with { Dataset = "support" } },
            valid with { QueryDefinition = query with { MeasureDimension = "TotalAmount" } },
            valid with { Appearance = new VisualizationAppearance(ShowLegend: true) }
        };
        var dashboards = new DashboardService(catalog, catalog, TimeProvider.System);
        foreach (var item in invalid)
        {
            Assert.ThrowsAsync<InvalidDashboardException>(async () =>
                await service.CreateAsync("northstar", "demo-owner", new("", item), Token));
            Assert.ThrowsAsync<InvalidDashboardException>(async () =>
                await dashboards.CreateAsync("northstar", "demo-owner",
                    new DashboardDraft("Invalid", "", [item]), Token));
        }
    }

    [Test]
    public async Task ApiEnforcesTenantIsolationAndPersistsTemplates()
    {
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, config) =>
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Catalog:Path"] = databasePath,
                    ["DevelopmentIdentity:Enabled"] = "true"
                }));
        });
        using var client = factory.CreateClient();
        var created = await client.PostAsJsonAsync("/api/organizations/northstar/visualizations", Draft(), ApiJson);
        Assert.That(created.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var document = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = document.GetProperty("id").GetString();
        Assert.That(id, Is.Not.Null);
        var fetched = await client.GetAsync($"/api/organizations/northstar/visualizations/{id}");
        var unauthorized = await client.GetAsync($"/api/organizations/isolated/visualizations/{id}");
        var unauthorizedList = await client.GetAsync("/api/organizations/isolated/visualizations");
        var unauthorizedCreate = await client.PostAsJsonAsync("/api/organizations/isolated/visualizations", Draft(), ApiJson);
        var saved = await client.GetAsync("/api/organizations/northstar/visualizations");
        Assert.Multiple(() =>
        {
            Assert.That(fetched.StatusCode, Is.EqualTo(HttpStatusCode.OK));
            Assert.That(saved.StatusCode, Is.EqualTo(HttpStatusCode.OK));
            Assert.That(unauthorized.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
            Assert.That(unauthorizedList.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
            Assert.That(unauthorizedCreate.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        });
        var update = await client.PutAsJsonAsync($"/api/organizations/northstar/visualizations/{id}",
            new SavedVisualizationUpdate("Updated description", Draft().Definition, 1), ApiJson);
        var stale = await client.PutAsJsonAsync($"/api/organizations/northstar/visualizations/{id}",
            new SavedVisualizationUpdate("Stale", Draft().Definition, 1), ApiJson);
        Assert.That(update.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(stale.StatusCode, Is.EqualTo(HttpStatusCode.Conflict));
        var delete = await client.DeleteAsync($"/api/organizations/northstar/visualizations/{id}?expectedRevision=2");
        Assert.That(delete.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));

        // Verify the new nested definition through real HTTP serialization and
        // persistence, rather than relying solely on direct service tests.
        var queryDraft = QueryDraft();
        var queryCreated = await client.PostAsJsonAsync("/api/organizations/northstar/visualizations", queryDraft, ApiJson);
        Assert.That(queryCreated.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var queryDocument = await queryCreated.Content.ReadFromJsonAsync<JsonElement>();
        var queryId = queryDocument.GetProperty("id").GetString();
        var queryFetched = await client.GetAsync($"/api/organizations/northstar/visualizations/{queryId}");
        Assert.That(queryFetched.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var querySaved = await queryFetched.Content.ReadFromJsonAsync<SavedVisualization>(ApiJson);
        Assert.That(querySaved!.Definition.QueryDefinition, Is.EqualTo(queryDraft.Definition.QueryDefinition));
        var queryDashboard = await client.PostAsJsonAsync("/api/organizations/northstar/dashboards",
            new DashboardDraft("Saved query via HTTP", "", [queryDraft.Definition]), ApiJson);
        Assert.That(queryDashboard.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var queryDashboardDocument = await queryDashboard.Content.ReadFromJsonAsync<JsonElement>();
        var queryDashboardId = queryDashboardDocument.GetProperty("id").GetString();
        var queryDashboardFetched = await client.GetAsync($"/api/organizations/northstar/dashboards/{queryDashboardId}");
        Assert.That(queryDashboardFetched.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var persistedQuery = await queryDashboardFetched.Content.ReadFromJsonAsync<Dashboard>(ApiJson);
        Assert.That(persistedQuery!.Widgets.Single().QueryDefinition, Is.EqualTo(queryDraft.Definition.QueryDefinition));
        var invalid = System.Text.Json.Nodes.JsonNode.Parse(JsonSerializer.Serialize(queryDraft, ApiJson))!;
        invalid["definition"]!["queryDefinition"]!["sql"] = "unapproved";
        var rejected = await client.PostAsJsonAsync("/api/organizations/northstar/visualizations", invalid, ApiJson);
        Assert.That(rejected.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
    }
}
