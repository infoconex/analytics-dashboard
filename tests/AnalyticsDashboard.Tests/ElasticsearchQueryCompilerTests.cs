using System.Text.Json;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using AnalyticsDashboard.Infrastructure;

namespace AnalyticsDashboard.Tests;

[TestFixture]
public sealed class ElasticsearchQueryCompilerTests
{
    private static readonly QueryDataset Sales = new("sales",
    [
        new QueryField("doc_id", QueryValueType.Text),
        new QueryField("region", QueryValueType.Text),
        new QueryField("amount", QueryValueType.Number),
        new QueryField("paid", QueryValueType.Boolean),
        new QueryField("occurred_at", QueryValueType.Timestamp)
    ]);

    private static readonly ElasticsearchDatasetBinding Binding = new(
        Sales, "nexa_provider_fixture", "doc_id",
        new Dictionary<string, ElasticsearchFieldBinding>
        {
            ["doc_id"] = new("doc_id", "doc_id", ExactKeyword: true),
            ["region"] = new("region.keyword", "region", ExactKeyword: true),
            ["amount"] = new("amount", "amount"),
            ["paid"] = new("paid", "paid"),
            ["occurred_at"] = new("occurred_at", "occurred_at")
        }, StableKeyIsUniqueAndPresent: true);

    [Test]
    public void DateAndCategoryFiltersAreStructuredAndAppliedBeforeAggregation()
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
        ], Aggregates:
        [
            new QueryAggregate("revenue", QueryAggregateFunction.Sum, "amount"),
            new QueryAggregate("orders", QueryAggregateFunction.Count)
        ]);

        var plan = new ElasticsearchQueryCompiler().Compile(Binding, request);
        using var json = JsonDocument.Parse(plan.RequestBody);
        var root = json.RootElement;
        var clauses = root.GetProperty("query").GetProperty("bool").GetProperty("filter");
        Assert.Multiple(() =>
        {
            Assert.That(plan.Index, Is.EqualTo("nexa_provider_fixture"));
            Assert.That(clauses.GetArrayLength(), Is.EqualTo(3));
            Assert.That(clauses[0].GetProperty("range").GetProperty("occurred_at")
                .GetProperty("gte").GetString(), Is.EqualTo("2026-11-15T16:30:00.0000000Z"));
            Assert.That(clauses[1].GetProperty("range").GetProperty("occurred_at")
                .GetProperty("lt").GetString(), Is.EqualTo("2026-11-16T01:00:00.0000000Z"));
            Assert.That(clauses[2].GetProperty("term").GetProperty("region.keyword")
                .GetProperty("value").GetString(), Is.EqualTo("West"));
            Assert.That(root.GetProperty("size").GetInt32(), Is.Zero);
            Assert.That(root.GetProperty("aggs").GetProperty("revenue")
                .GetProperty("sum").GetProperty("field").GetString(), Is.EqualTo("amount"));
            Assert.That(root.GetProperty("aggs").GetProperty("orders")
                .GetProperty("value_count").GetProperty("field").GetString(), Is.EqualTo("doc_id"));
        });
    }

    [Test]
    public void UserTextCannotInjectDslScriptsOrIndexPaths()
    {
        const string payload = "\"}, \"script\": {\"source\":\"return true\"}, \"term\": {\"region\": \"";
        var query = new QueryRequest("sales", ["region"],
            [new QueryFilter("region", QueryOperator.Equal,
                [new QueryScalar(QueryValueType.Text, Text: payload)])]);
        var plan = new ElasticsearchQueryCompiler().Compile(Binding, query);
        using var json = JsonDocument.Parse(plan.RequestBody);
        var actual = json.RootElement.GetProperty("query").GetProperty("bool")
            .GetProperty("filter")[0].GetProperty("term").GetProperty("region.keyword")
            .GetProperty("value").GetString();
        Assert.That(actual, Is.EqualTo(payload));
        Assert.That(json.RootElement.TryGetProperty("script", out _), Is.False);
        Assert.That(plan.RequestBody, Does.Not.Contain("query_string"));
    }

    [Test]
    public void RawRowsUseApprovedSourcePathsAndStableSort()
    {
        var request = new QueryRequest("sales", ["region", "amount"],
            Sort: [new QuerySort("amount", QuerySortDirection.Descending)], Limit: 7, Offset: 2);
        var plan = new ElasticsearchQueryCompiler().Compile(Binding, request);
        using var json = JsonDocument.Parse(plan.RequestBody);
        var root = json.RootElement;
        Assert.Multiple(() =>
        {
            Assert.That(root.GetProperty("size").GetInt32(), Is.EqualTo(7));
            Assert.That(root.GetProperty("from").GetInt32(), Is.EqualTo(2));
            Assert.That(root.GetProperty("_source").GetProperty("includes").EnumerateArray()
                .Select(x => x.GetString()), Is.EqualTo(new[] { "region", "amount" }));
            Assert.That(root.GetProperty("sort").GetArrayLength(), Is.EqualTo(2));
            Assert.That(root.GetProperty("sort")[1].GetProperty("doc_id")
                .GetProperty("order").GetString(), Is.EqualTo("asc"));
        });
    }

    [Test]
    public void GroupingUsesBoundedCompositeBucketsAndPreAggregateFilter()
    {
        var request = new QueryRequest("sales", ["region"],
            [new QueryFilter("paid", QueryOperator.Equal,
                [new QueryScalar(QueryValueType.Boolean, Boolean: true)])],
            GroupBy: ["region"],
            Aggregates: [new QueryAggregate("revenue", QueryAggregateFunction.Sum, "amount")],
            Sort: [new QuerySort("region", QuerySortDirection.Ascending)], Limit: 25);
        var plan = new ElasticsearchQueryCompiler().Compile(Binding, request);
        using var json = JsonDocument.Parse(plan.RequestBody);
        var root = json.RootElement;
        Assert.Multiple(() =>
        {
            Assert.That(root.GetProperty("query").GetProperty("bool").GetProperty("filter")
                .GetArrayLength(), Is.EqualTo(1));
            Assert.That(root.GetProperty("size").GetInt32(), Is.Zero);
            Assert.That(root.GetProperty("aggs").GetProperty("groups").GetProperty("composite")
                .GetProperty("size").GetInt32(), Is.EqualTo(25));
            Assert.That(root.GetProperty("aggs").GetProperty("groups").GetProperty("aggs")
                .GetProperty("revenue").GetProperty("sum")
                .GetProperty("field").GetString(), Is.EqualTo("amount"));
        });
    }

    [Test]
    public void NotEqualRequiresFieldToExistLikeSqlNullSemantics()
    {
        var q = new QueryRequest("sales", ["doc_id"],
            [new QueryFilter("region", QueryOperator.NotEqual,
                [new QueryScalar(QueryValueType.Text, Text: "West")])]);
        using var json = JsonDocument.Parse(new ElasticsearchQueryCompiler().Compile(Binding, q).RequestBody);
        var predicate = json.RootElement.GetProperty("query").GetProperty("bool")
            .GetProperty("filter")[0].GetProperty("bool");
        Assert.That(predicate.GetProperty("filter")[0].GetProperty("exists")
            .GetProperty("field").GetString(), Is.EqualTo("region.keyword"));
        Assert.That(predicate.GetProperty("must_not").GetArrayLength(), Is.EqualTo(1));
    }

    [Test]
    public void RejectsArbitraryIndexFieldsUnsupportedOperatorsAndPaging()
    {
        var compiler = new ElasticsearchQueryCompiler();
        var query = new QueryRequest("sales", ["doc_id"]);
        Assert.Throws<InvalidQueryException>(() => compiler.Compile(Binding with { Index = "orders-*" }, query));
        Assert.Throws<InvalidQueryException>(() => compiler.Compile(Binding with
        {
            Fields = new Dictionary<string, ElasticsearchFieldBinding>(
                Binding.Fields, StringComparer.Ordinal)
            {
                ["region"] = new("region;DROP", "region", ExactKeyword: true)
            }
        }, query));
        Assert.Throws<InvalidQueryException>(() => compiler.Compile(Binding with
        {
            Fields = new Dictionary<string, ElasticsearchFieldBinding>(
                Binding.Fields, StringComparer.Ordinal)
            {
                ["region"] = new("region", "region", ExactKeyword: false)
            }
        }, query));
        Assert.Throws<InvalidQueryException>(() => compiler.Compile(
            Binding with { StableKeyIsUniqueAndPresent = false }, query));
        Assert.Throws<InvalidQueryException>(() => compiler.Compile(Binding, new QueryRequest("sales",
            ["region"], [new QueryFilter("region", QueryOperator.Contains,
                [new QueryScalar(QueryValueType.Text, Text: "W")])])));
        Assert.Throws<InvalidQueryException>(() => compiler.Compile(Binding,
            new QueryRequest("sales", ["region"], GroupBy: ["region"], Offset: 1)));
        Assert.Throws<InvalidQueryException>(() => compiler.Compile(Binding,
            new QueryRequest("sales", ["region"], GroupBy: ["region"],
                Aggregates: [new QueryAggregate("total", QueryAggregateFunction.Sum, "amount")],
                Sort: [new QuerySort("total", QuerySortDirection.Descending)])));
    }
}
