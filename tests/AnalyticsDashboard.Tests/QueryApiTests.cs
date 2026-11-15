using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace AnalyticsDashboard.Tests;

public sealed class QueryApiTests
{
    private const string Sources = "/api/organizations/northstar/data-sources";
    private string databasePath = null!;
    private WebApplicationFactory<Program> factory = null!;
    private HttpClient client = null!;

    [SetUp]
    public void SetUp()
    {
        databasePath = Path.Combine(Path.GetTempPath(), $"analytics-query-api-{Guid.NewGuid():N}.db");
        factory = CreateFactory(false);
        client = factory.CreateClient();
    }

    private WebApplicationFactory<Program> CreateFactory(bool testCatalog) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, configuration) =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Catalog:Path"] = databasePath,
                    ["DevelopmentIdentity:Enabled"] = "true"
                }));
            if (testCatalog)
                builder.ConfigureTestServices(services =>
                {
                    services.RemoveAll<IQueryDatasetCatalog>();
                    services.AddSingleton<IQueryDatasetCatalog, TestDatasetCatalog>();
                });
        });

    [TearDown]
    public void TearDown()
    {
        client.Dispose();
        factory.Dispose();
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        if (File.Exists(databasePath)) File.Delete(databasePath);
    }

    [Test]
    public async Task DefaultCatalogRejectsEveryDatasetWithoutConnecting()
    {
        var address = await RegisterAsync();
        var response = await client.PostAsJsonAsync(address, new
        {
            dataset = "sales", projection = new[] { "region" }
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await response.Content.ReadAsStringAsync()),
            Does.Contain("Dataset is not available"));
    }

    [Test]
    public async Task GuessedSourceAndOtherOrganizationDoNotExposeSchemas()
    {
        var created = await RegisterAsync();
        var request = new { dataset = "sales", projection = new[] { "region" } };
        var missing = await client.PostAsJsonAsync($"{Sources}/{Guid.NewGuid()}/queries/validate", request);
        var foreign = await client.PostAsJsonAsync(
            created.Replace("/northstar/", "/isolated/", StringComparison.Ordinal), request);

        Assert.Multiple(() =>
        {
            Assert.That(missing.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
            Assert.That(foreign.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        });
    }

    [Test]
    public async Task UnknownFieldsAndRawExecutionInputsFailAtJsonBoundary()
    {
        var address = await RegisterAsync();
        var rawSql = await client.PostAsJsonAsync(address,
            new { dataset = "sales", projection = new[] { "region" }, sql = "SELECT * FROM users" });
        var dsl = await client.PostAsJsonAsync(address,
            new { dataset = "sales", projection = new[] { "region" }, query = new { match_all = new { } } });
        var endpoint = await client.PostAsJsonAsync(address,
            new { dataset = "sales", projection = new[] { "region" }, endpoint = "https://example.invalid" });
        var secret = await client.PostAsJsonAsync(address,
            new { dataset = "sales", projection = new[] { "region" }, connectionString = "not-allowed" });
        var nested = await client.PostAsJsonAsync(address, new
        {
            dataset = "sales", projection = new[] { "region" }, filters = new[]
            {
                new { field = "region", @operator = "equal", values = new[]
                {
                    new { type = "text", text = "north", password = "not-allowed" }
                } }
            }
        });
        var numericEnum = await client.PostAsJsonAsync(address, new
        {
            dataset = "sales", projection = new[] { "region" }, filters = new[]
            {
                new { field = "region", @operator = 0 }
            }
        });

        Assert.Multiple(() =>
        {
            Assert.That(rawSql.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(dsl.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(endpoint.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(secret.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(nested.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(numericEnum.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        });
    }

    [Test]
    public async Task AllowedDatasetReturnsValidationSchemaButNotRows()
    {
        client.Dispose();
        factory.Dispose();
        factory = CreateFactory(true);
        client = factory.CreateClient();
        var address = await RegisterAsync();
        var response = await client.PostAsJsonAsync(address, new
        {
            dataset = "sales", projection = new[] { "region" }, limit = 20
        });
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
            Assert.That(body.GetProperty("executable").GetBoolean(), Is.False);
            Assert.That(body.GetProperty("limit").GetInt32(), Is.EqualTo(20));
            Assert.That(body.GetProperty("columns")[0].GetProperty("type").GetString(), Is.EqualTo("text"));
            Assert.That(body.TryGetProperty("rows", out _), Is.False);
            Assert.That(body.TryGetProperty("connectionString", out _), Is.False);
        });
    }

    [Test]
    public void FutureResultContractRetainsTypedCellsAndTruncation()
    {
        var result = new QueryResult([new QueryColumn("region", QueryValueType.Text)],
            [new QueryScalar?[] { new(QueryValueType.Text, Text: "north") }],
            Offset: 0, Limit: 1, HasMore: true, Truncated: true);
        Assert.Multiple(() =>
        {
            Assert.That(result.Rows[0][0]?.Text, Is.EqualTo("north"));
            Assert.That(result.Columns[0].Type, Is.EqualTo(QueryValueType.Text));
            Assert.That(result.HasMore, Is.True);
            Assert.That(result.Truncated, Is.True);
        });
    }

    private async Task<string> RegisterAsync()
    {
        var created = await client.PostAsJsonAsync(Sources,
            new { name = "Reporting", provider = "sqlite" });
        Assert.That(created.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var body = await created.Content.ReadFromJsonAsync<JsonElement>();
        return $"{Sources}/{body.GetProperty("id").GetString()}/queries/validate";
    }

    private sealed class TestDatasetCatalog : IQueryDatasetCatalog
    {
        public Task<QueryDataset?> FindAsync(string organizationId, Guid dataSourceId, string dataset,
            CancellationToken cancellationToken) => Task.FromResult<QueryDataset?>(
                organizationId == "northstar" && dataset == "sales"
                    ? new QueryDataset("sales", [new QueryField("region", QueryValueType.Text)])
                    : null);
    }
}
