using System.Net;
using System.Text;
using System.Text.Json;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using AnalyticsDashboard.Infrastructure;

namespace AnalyticsDashboard.Tests;

/// <summary>
/// Real disposable Elasticsearch fixture. All HTTP is test-local loopback;
/// no production Elasticsearch transport or API route is introduced.
/// </summary>
[TestFixture]
[Category("ElasticsearchIntegration")]
[NonParallelizable]
public sealed class ElasticsearchProviderIntegrationTests
{
    private const string Index = "nexa_provider_fixture";
    private static readonly QueryDataset Sales = new("sales",
    [
        new QueryField("doc_id", QueryValueType.Text),
        new QueryField("region", QueryValueType.Text),
        new QueryField("amount", QueryValueType.Number),
        new QueryField("paid", QueryValueType.Boolean),
        new QueryField("occurred_at", QueryValueType.Timestamp)
    ]);

    private static readonly ElasticsearchDatasetBinding Binding = new(
        Sales, Index, "doc_id",
        new Dictionary<string, ElasticsearchFieldBinding>
        {
            ["doc_id"] = new("doc_id", "doc_id", ExactKeyword: true),
            ["region"] = new("region", "region", ExactKeyword: true),
            ["amount"] = new("amount", "amount"),
            ["paid"] = new("paid", "paid"),
            ["occurred_at"] = new("occurred_at", "occurred_at")
        }, StableKeyIsUniqueAndPresent: true);

    private readonly HttpClient http = new()
    {
        BaseAddress = new Uri("http://127.0.0.1:19200"),
        Timeout = TimeSpan.FromSeconds(20)
    };

    [OneTimeSetUp]
    public async Task SetUpAsync()
    {
        var ready = false;
        for (var attempt = 0; attempt < 100; attempt++)
        {
            try
            {
                using var response = await http.GetAsync("/");
                if (response.IsSuccessStatusCode) { ready = true; break; }
            }
            catch (HttpRequestException) { /* fixture still booting */ }
            catch (TaskCanceledException) { /* fixture still booting */ }
            await Task.Delay(TimeSpan.FromSeconds(2));
        }
        if (!ready) throw new InvalidOperationException("Disposable Elasticsearch fixture did not become ready.");

        const string mapping = """
            {"mappings":{"properties":{"doc_id":{"type":"keyword"},"region":{"type":"keyword"},"amount":{"type":"double"},"paid":{"type":"boolean"},"occurred_at":{"type":"date_nanos"}}}}
            """;
        using (var created = await http.PutAsync("/" + Index,
            new StringContent(mapping, Encoding.UTF8, "application/json")))
            Assert.That(created.StatusCode, Is.EqualTo(HttpStatusCode.OK));

        const string bulk = """
            {"index":{"_index":"nexa_provider_fixture","_id":"1"}}
            {"doc_id":"1","region":"West","amount":12.5,"paid":true,"occurred_at":"2026-11-15T16:30:00.0000000Z"}
            {"index":{"_index":"nexa_provider_fixture","_id":"2"}}
            {"doc_id":"2","region":"East","amount":8.75,"paid":false,"occurred_at":"2026-11-14T12:00:00.0000000Z"}
            {"index":{"_index":"nexa_provider_fixture","_id":"3"}}
            {"doc_id":"3","region":"West","amount":31,"paid":true,"occurred_at":"2026-11-16T01:00:00.0000000Z"}
            {"index":{"_index":"nexa_provider_fixture","_id":"4"}}
            {"doc_id":"4","amount":4.5,"paid":false,"occurred_at":"2026-11-17T00:00:00.0000000Z"}

            """;
        using var seeded = await http.PostAsync("/_bulk?refresh=wait_for",
            new StringContent(bulk, Encoding.UTF8, "application/x-ndjson"));
        Assert.That(seeded.IsSuccessStatusCode, Is.True);
        using var summary = JsonDocument.Parse(await seeded.Content.ReadAsStringAsync());
        Assert.That(summary.RootElement.GetProperty("errors").GetBoolean(), Is.False);
    }

    [OneTimeTearDown]
    public async Task TearDownAsync()
    {
        try { using var removed = await http.DeleteAsync("/" + Index); }
        finally { http.Dispose(); }
    }

    [Test]
    public async Task RealProviderAppliesUtcBoundsAndRegionBeforeAggregation()
    {
        var start = new DateTimeOffset(2026, 11, 15, 8, 30, 0, TimeSpan.FromHours(-8));
        var end = new DateTimeOffset(2026, 11, 16, 1, 0, 0, TimeSpan.Zero);
        var request = new QueryRequest("sales", [],
        [
            new QueryFilter("occurred_at", QueryOperator.GreaterThanOrEqual,
                [new QueryScalar(QueryValueType.Timestamp, Timestamp: start)]),
            new QueryFilter("occurred_at", QueryOperator.LessThan,
                [new QueryScalar(QueryValueType.Timestamp, Timestamp: end)]),
            new QueryFilter("region", QueryOperator.Equal,
                [new QueryScalar(QueryValueType.Text, Text: "West")])
        ], Aggregates: [
            new QueryAggregate("revenue", QueryAggregateFunction.Sum, "amount"),
            new QueryAggregate("orders", QueryAggregateFunction.Count)
        ]);

        using var result = await SearchAsync(request);
        Assert.That(result.RootElement.GetProperty("aggregations").GetProperty("revenue")
            .GetProperty("value").GetDouble(), Is.EqualTo(12.5).Within(0.001));
        Assert.That(result.RootElement.GetProperty("aggregations").GetProperty("orders")
            .GetProperty("value").GetDouble(), Is.EqualTo(1));
    }

    [Test]
    public async Task GroupedRevenueUsesCompositeAndRespectsFilterContext()
    {
        var request = new QueryRequest("sales", ["region"],
            [new QueryFilter("paid", QueryOperator.Equal,
                [new QueryScalar(QueryValueType.Boolean, Boolean: true)])],
            GroupBy: ["region"],
            Aggregates: [new QueryAggregate("revenue", QueryAggregateFunction.Sum, "amount")],
            Sort: [new QuerySort("region", QuerySortDirection.Ascending)]);
        using var result = await SearchAsync(request);
        var buckets = result.RootElement.GetProperty("aggregations")
            .GetProperty("groups").GetProperty("buckets");
        Assert.That(buckets.GetArrayLength(), Is.EqualTo(1));
        Assert.That(buckets[0].GetProperty("key").GetProperty("region").GetString(), Is.EqualTo("West"));
        Assert.That(buckets[0].GetProperty("revenue").GetProperty("value")
            .GetDouble(), Is.EqualTo(43.5).Within(0.001));
    }

    [Test]
    public async Task NotEqualExcludesMissingFieldsAndLiteralInjectionIsHarmless()
    {
        var neq = new QueryRequest("sales", ["doc_id"],
            [new QueryFilter("region", QueryOperator.NotEqual,
                [new QueryScalar(QueryValueType.Text, Text: "West")])]);
        using (var result = await SearchAsync(neq))
        {
            var hits = result.RootElement.GetProperty("hits").GetProperty("hits");
            Assert.That(hits.GetArrayLength(), Is.EqualTo(1));
            Assert.That(hits[0].GetProperty("_source").GetProperty("doc_id").GetString(), Is.EqualTo("2"));
        }

        const string attack = "\"}, \"script\":{\"source\":\"true\"}";
        var injected = new QueryRequest("sales", ["doc_id"],
            [new QueryFilter("region", QueryOperator.Equal,
                [new QueryScalar(QueryValueType.Text, Text: attack)])]);
        using var empty = await SearchAsync(injected);
        Assert.That(empty.RootElement.GetProperty("hits").GetProperty("hits").GetArrayLength(), Is.Zero);
    }

    private async Task<JsonDocument> SearchAsync(QueryRequest request)
    {
        var plan = new ElasticsearchQueryCompiler().Compile(Binding, request);
        using var response = await http.PostAsync("/" + plan.Index + "/_search",
            new StringContent(plan.RequestBody, Encoding.UTF8, "application/json"));
        var body = await response.Content.ReadAsStringAsync();
        Assert.That(response.IsSuccessStatusCode, Is.True,
            "Disposable Elasticsearch query failed: " + body);
        return JsonDocument.Parse(body);
    }
}
