using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace AnalyticsDashboard.Tests;

public sealed class DataSourceApiTests
{
    private const string Collection = "/api/organizations/northstar/data-sources";
    private string databasePath = null!;
    private WebApplicationFactory<Program> factory = null!;
    private HttpClient client = null!;

    [SetUp]
    public void SetUp()
    {
        databasePath = Path.Combine(Path.GetTempPath(), $"analytics-source-api-{Guid.NewGuid():N}.db");
        factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, configuration) =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
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
    public async Task RegistrationAndReadExposeOnlyRegistrationMetadata()
    {
        var created = await client.PostAsJsonAsync(Collection,
            new { name = "Reporting", provider = "postgreSql" });
        var payload = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = payload.GetProperty("id").GetString();
        var found = await client.GetAsync($"{Collection}/{id}");
        var listed = await client.GetAsync(Collection);
        var body = await found.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Multiple(() =>
        {
            Assert.That(created.StatusCode, Is.EqualTo(HttpStatusCode.Created));
            Assert.That(found.StatusCode, Is.EqualTo(HttpStatusCode.OK));
            Assert.That(listed.StatusCode, Is.EqualTo(HttpStatusCode.OK));
            Assert.That(body.GetProperty("provider").GetString(), Is.EqualTo("postgreSql"));
            Assert.That(body.GetProperty("organizationId").GetString(), Is.EqualTo("northstar"));
            Assert.That(body.GetProperty("revision").GetInt32(), Is.EqualTo(1));
            Assert.That(body.GetProperty("createdBy").GetString(), Is.EqualTo("demo-owner"));
            Assert.That(body.TryGetProperty("connectionString", out _), Is.False);
            Assert.That(body.TryGetProperty("endpoint", out _), Is.False);
            Assert.That(body.TryGetProperty("credentials", out _), Is.False);
        });
    }

    [Test]
    public async Task AuthenticatedUserCannotListOrMutateAnotherOrganization()
    {
        var existing = await CreateAsync();
        var id = existing.GetProperty("id").GetString();
        var foreign = "/api/organizations/isolated/data-sources";
        var deniedList = await client.GetAsync(foreign);
        var deniedRead = await client.GetAsync($"{foreign}/{id}");
        var deniedCreate = await client.PostAsJsonAsync(foreign,
            new { name = "Denied", provider = "sqlite" });
        var deniedRename = await client.PutAsJsonAsync($"{foreign}/{id}",
            new { name = "Denied", expectedRevision = 1 });
        var deniedDelete = await client.DeleteAsync($"{foreign}/{id}?expectedRevision=1");

        Assert.Multiple(() =>
        {
            Assert.That(deniedList.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
            Assert.That(deniedRead.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
            Assert.That(deniedCreate.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
            Assert.That(deniedRename.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
            Assert.That(deniedDelete.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        });
    }

    [Test]
    public async Task RevisionMustMatchForRenameAndDelete()
    {
        var existing = await CreateAsync();
        var address = $"{Collection}/{existing.GetProperty("id").GetString()}";
        var updated = await client.PutAsJsonAsync(address, new { name = "Updated", expectedRevision = 1 });
        var outdated = await client.PutAsJsonAsync(address, new { name = "Overwritten", expectedRevision = 1 });
        var staleDelete = await client.DeleteAsync($"{address}?expectedRevision=1");
        var deleted = await client.DeleteAsync($"{address}?expectedRevision=2");
        var missing = await client.GetAsync(address);

        Assert.Multiple(() =>
        {
            Assert.That(updated.StatusCode, Is.EqualTo(HttpStatusCode.OK));
            Assert.That(outdated.StatusCode, Is.EqualTo(HttpStatusCode.Conflict));
            Assert.That(staleDelete.StatusCode, Is.EqualTo(HttpStatusCode.Conflict));
            Assert.That(deleted.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
            Assert.That(missing.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        });
    }

    [Test]
    public async Task InvalidPayloadsAndSecretOrEndpointFieldsAreRejected()
    {
        var invalidProvider = await client.PostAsJsonAsync(Collection,
            new { name = "Unknown", provider = "oracle" });
        var numericProvider = await client.PostAsJsonAsync(Collection,
            new { name = "Numeric", provider = 0 });
        var missingProvider = await client.PostAsJsonAsync(Collection, new { name = "Missing" });
        var invalidName = await client.PostAsJsonAsync(Collection,
            new { name = "  ", provider = "sqlite" });
        var connectionString = await client.PostAsJsonAsync(Collection,
            new { name = "Forbidden", provider = "sqlite", connectionString = "should-never-be-stored" });
        var endpoint = await client.PostAsJsonAsync(Collection,
            new { name = "Forbidden", provider = "elasticSearch", endpoint = "example.invalid" });

        Assert.Multiple(() =>
        {
            Assert.That(invalidProvider.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(numericProvider.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(missingProvider.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(invalidName.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(connectionString.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(endpoint.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        });
        var listed = await client.GetFromJsonAsync<JsonElement>(Collection);
        Assert.That(listed.GetArrayLength(), Is.Zero);
    }

    [Test]
    public async Task RenamingRejectsUnexpectedFieldsAndBadRevisions()
    {
        var existing = await CreateAsync();
        var address = $"{Collection}/{existing.GetProperty("id").GetString()}";
        var secret = await client.PutAsJsonAsync(address,
            new { name = "Bad", expectedRevision = 1, password = "should-never-be-stored" });
        var provider = await client.PutAsJsonAsync(address,
            new { name = "Bad", expectedRevision = 1, provider = "mysql" });
        var revision = await client.PutAsJsonAsync(address,
            new { name = "Bad", expectedRevision = 0 });
        var missingDeleteRevision = await client.DeleteAsync(address);

        Assert.Multiple(() =>
        {
            Assert.That(secret.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(provider.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(revision.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(missingDeleteRevision.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        });
    }

    private async Task<JsonElement> CreateAsync()
    {
        var result = await client.PostAsJsonAsync(Collection,
            new { name = "Original", provider = "sqlServer" });
        Assert.That(result.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        return await result.Content.ReadFromJsonAsync<JsonElement>();
    }
}
