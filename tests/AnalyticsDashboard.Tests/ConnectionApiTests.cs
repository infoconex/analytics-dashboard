using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using AnalyticsDashboard.Application;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace AnalyticsDashboard.Tests;

public sealed class ConnectionApiTests
{
    private const string Base = "/api/organizations/northstar/data-sources";
    private sealed class PublicDns : IDnsResolver
    {
        public Task<IPAddress[]> ResolveAsync(string host, CancellationToken token) =>
            Task.FromResult(new[] { IPAddress.Parse("8.8.8.8") });
    }

    private string databasePath = null!;
    private WebApplicationFactory<Program> factory = null!;
    private HttpClient client = null!;

    [SetUp]
    public void SetUp()
    {
        databasePath = Path.Combine(Path.GetTempPath(), $"analytics-connection-api-{Guid.NewGuid():N}.db");
        var key = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, configuration) =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Catalog:Path"] = databasePath,
                    ["DevelopmentIdentity:Enabled"] = "true",
                    ["ConnectionSecurity:ActiveKeyId"] = "testing",
                    ["ConnectionSecurity:Keys:testing"] = key,
                    ["ConnectionSecurity:AllowedDestinations:PostgreSql:0"] = "db.example.com:5432"
                }));
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IDnsResolver>();
                services.AddSingleton<IDnsResolver, PublicDns>();
            });
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
    public async Task OwnerCanConfigureRotateRewrapAndRevokeWithoutSecretReadback()
    {
        var id = await RegisterAsync();
        var address = $"{Base}/{id}/connection";
        var configured = await client.PutAsJsonAsync(address, Request("api-credential-sentinel", 0));
        var configuredJson = await configured.Content.ReadFromJsonAsync<JsonElement>();
        var found = await client.GetAsync(address);
        var rotated = await client.PostAsJsonAsync($"{address}/rotate",
            new { credential = "rotated-api-credential", expectedRevision = 1 });
        var rewrapped = await client.PostAsJsonAsync($"{address}/rewrap",
            new { expectedRevision = 2 });
        var revoked = await client.DeleteAsync($"{address}?expectedRevision=3");
        var missing = await client.GetAsync(address);
        var originalDefinition = await client.GetAsync($"{Base}/{id}");
        var originalText = await originalDefinition.Content.ReadAsStringAsync();
        var responses = string.Join("\n", await configured.Content.ReadAsStringAsync(),
            await found.Content.ReadAsStringAsync(), await rotated.Content.ReadAsStringAsync(),
            await rewrapped.Content.ReadAsStringAsync());

        Assert.Multiple(() =>
        {
            Assert.That(configured.StatusCode, Is.EqualTo(HttpStatusCode.OK));
            Assert.That(configuredJson.GetProperty("hasCredential").GetBoolean(), Is.True);
            Assert.That(configuredJson.GetProperty("revision").GetInt32(), Is.EqualTo(1));
            Assert.That(found.StatusCode, Is.EqualTo(HttpStatusCode.OK));
            Assert.That(rotated.StatusCode, Is.EqualTo(HttpStatusCode.OK));
            Assert.That(rewrapped.StatusCode, Is.EqualTo(HttpStatusCode.OK));
            Assert.That(revoked.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
            Assert.That(missing.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
            Assert.That(responses, Does.Not.Contain("credential"));
            Assert.That(responses, Does.Not.Contain("ciphertext"));
            Assert.That(responses, Does.Not.Contain("db.example.com"));
            Assert.That(originalText, Does.Not.Contain("connection"));
        });
    }

    [Test]
    public async Task TenantIsolationAndRevisionConflictsApplyToConnectionEndpoints()
    {
        var id = await RegisterAsync();
        var address = $"{Base}/{id}/connection";
        var foreign = $"/api/organizations/isolated/data-sources/{id}/connection";
        var deniedRead = await client.GetAsync(foreign);
        var deniedConfigure = await client.PutAsJsonAsync(foreign, Request("secret", 0));
        await client.PutAsJsonAsync(address, Request("secret", 0));
        var stale = await client.PutAsJsonAsync(address, Request("secret-replacement", 0));
        var wrongDelete = await client.DeleteAsync($"{address}?expectedRevision=2");
        var deniedRotate = await client.PostAsJsonAsync($"{foreign}/rotate",
            new { credential = "nope", expectedRevision = 1 });

        Assert.Multiple(() =>
        {
            Assert.That(deniedRead.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
            Assert.That(deniedConfigure.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
            Assert.That(stale.StatusCode, Is.EqualTo(HttpStatusCode.Conflict));
            Assert.That(wrongDelete.StatusCode, Is.EqualTo(HttpStatusCode.Conflict));
            Assert.That(deniedRotate.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        });
    }

    [Test]
    public async Task UnknownPropertiesRawConnectionStringsAndProviderMismatchesAreRejected()
    {
        var id = await RegisterAsync();
        var address = $"{Base}/{id}/connection";
        var unknown = await client.PutAsJsonAsync(address, new
        {
            network = new { host = "db.example.com", port = 5432, database = "analytics",
                username = "reader", trustServerCertificate = true },
            credential = "secret", expectedRevision = 0
        });
        var raw = await client.PutAsJsonAsync(address, new
        {
            network = new { host = "db.example.com", port = 5432, database = "analytics",
                username = "reader" },
            credential = "secret", expectedRevision = 0, connectionString = "Host=localhost;Password=secret"
        });
        var sqlite = await client.PutAsJsonAsync(address, new
        {
            sqlite = new { fileId = "unapproved" }, credential = "secret", expectedRevision = 0
        });
        var badHost = await client.PutAsJsonAsync(address,
            Request("credential", 0) with
            {
                Network = new NetworkConnectionRequest("127.0.0.1", 5432, "analytics", "reader")
            });

        Assert.Multiple(() =>
        {
            Assert.That(unknown.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(raw.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(sqlite.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(badHost.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        });
        var find = await client.GetAsync(address);
        Assert.That(find.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
    }

    private async Task<string> RegisterAsync()
    {
        var response = await client.PostAsJsonAsync(Base,
            new { name = "Reporting", provider = "postgreSql" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetString()!;
    }

    private static ConnectionConfigurationRequest Request(string credential, int revision) =>
        new(new NetworkConnectionRequest("db.example.com", 5432, "analytics", "reader"),
            null, credential, revision);
}
