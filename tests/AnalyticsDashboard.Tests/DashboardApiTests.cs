using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace AnalyticsDashboard.Tests;

public sealed class DashboardApiTests
{
    private string databasePath = null!;
    private WebApplicationFactory<Program> factory = null!;
    private HttpClient client = null!;

    [SetUp]
    public void SetUp()
    {
        databasePath = Path.Combine(Path.GetTempPath(), $"analytics-api-{Guid.NewGuid():N}.db");
        factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, config) =>
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Catalog:Path"] = databasePath,
                    ["DevelopmentIdentity:Enabled"] = "true"
                }));
        });
        client = factory.CreateClient();
    }

    [TearDown]
    public void TearDown()
    {
        client.Dispose();
        factory.Dispose();
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        if (File.Exists(databasePath)) File.Delete(databasePath);
    }

    [Test]
    public async Task MembershipLimitsApiAccessToOneOrganization()
    {
        var allowed = await client.GetAsync("/api/organizations/northstar/dashboards");
        var forbidden = await client.GetAsync("/api/organizations/isolated/dashboards");

        Assert.Multiple(() =>
        {
            Assert.That(allowed.StatusCode, Is.EqualTo(HttpStatusCode.OK));
            Assert.That(forbidden.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        });
    }

    [Test]
    public async Task KnownDashboardIdentifierCannotBypassOrganizationBoundary()
    {
        const string dashboardId = "a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441";
        var authorized = await client.GetAsync($"/api/organizations/northstar/dashboards/{dashboardId}");
        var crossTenant = await client.GetAsync($"/api/organizations/isolated/dashboards/{dashboardId}");
        var missing = await client.GetAsync(
            "/api/organizations/northstar/dashboards/11111111-1111-4111-8111-111111111111");

        Assert.Multiple(() =>
        {
            Assert.That(authorized.StatusCode, Is.EqualTo(HttpStatusCode.OK));
            Assert.That(crossTenant.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
            Assert.That(missing.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        });
    }

    [Test]
    public async Task DashboardCreationIsAvailableToAuthorizedEditor()
    {
        var draft = new DashboardDraft("API dashboard", "Created in the integration test", []);
        var created = await client.PostAsJsonAsync("/api/organizations/northstar/dashboards", draft);
        var responseBody = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = responseBody.GetProperty("id").GetString();
        var persisted = await client.GetAsync($"/api/organizations/northstar/dashboards/{id}");

        Assert.Multiple(() =>
        {
            Assert.That(created.StatusCode, Is.EqualTo(HttpStatusCode.Created));
            Assert.That(persisted.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        });
    }

    [Test]
    public async Task StaleEditsReturnConflict()
    {
        var created = await client.PostAsJsonAsync("/api/organizations/northstar/dashboards",
            new DashboardDraft("Original", "", []));
        var original = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = original.GetProperty("id").GetString();
        var address = $"/api/organizations/northstar/dashboards/{id}";

        var revisionOne = new { name = "Updated", description = "", widgets = Array.Empty<object>(), expectedRevision = 1 };
        var success = await client.PutAsJsonAsync(address, revisionOne);
        var conflict = await client.PutAsJsonAsync(address, revisionOne);

        Assert.Multiple(() =>
        {
            Assert.That(success.StatusCode, Is.EqualTo(HttpStatusCode.OK));
            Assert.That(conflict.StatusCode, Is.EqualTo(HttpStatusCode.Conflict));
        });
    }

    [Test]
    public void ProductionRequiresTrustedAuthenticationConfiguration()
    {
        using var productionFactory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.ConfigureAppConfiguration((_, configuration) =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Catalog:Path"] = databasePath,
                    ["DevelopmentIdentity:Enabled"] = "true",
                    ["Authentication:Authority"] = "",
                    ["Authentication:Audience"] = ""
                }));
        });

        var error = Assert.Throws<InvalidOperationException>(() => productionFactory.CreateClient());
        Assert.That(error?.Message, Does.Contain("Authentication:Authority"));
    }
}
