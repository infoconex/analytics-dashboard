using System.Text.Json;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using AnalyticsDashboard.Infrastructure;
using Microsoft.Data.Sqlite;

namespace AnalyticsDashboard.Tests;

[TestFixture]
public sealed class DashboardFilterPlannerTests
{
    private const string Region = "customer_region";
    private const string Attack = "' OR 1=1; DROP TABLE sales; --";
    private static readonly DateTimeOffset Start = new(2026, 11, 15, 8, 30, 0, TimeSpan.FromHours(-8));
    private static readonly DateTimeOffset End = new(2026, 11, 16, 1, 0, 0, TimeSpan.Zero);

    private static QueryDataset Dataset(string name, string date, string region) => new(name,
    [
        new QueryField("id", QueryValueType.Number),
        new QueryField(date, QueryValueType.Timestamp, BusinessDimension: DashboardFilterPlanner.ReportingTime),
        new QueryField(region, QueryValueType.Text, BusinessDimension: Region),
        new QueryField("amount", QueryValueType.Number),
        new QueryField("paid", QueryValueType.Boolean)
    ]);

    private static QueryRequest Aggregate(string name) => new(name,
        Aggregates: [new QueryAggregate("total", QueryAggregateFunction.Sum, "amount"),
            new QueryAggregate("count", QueryAggregateFunction.Count)]);

    private static SharedFieldFilter Selected(string value = "Pacific") =>
        new(Region, QueryValueType.Text, QueryOperator.Equal,
            [new QueryScalar(QueryValueType.Text, Text: value)]);

    private static SharedDashboardFilters Context(string value = "Pacific") =>
        new(new SharedDateRange(Start, End), [Selected(value)]);

    [Test]
    public void SameSemanticSelectionsMapToDifferentPhysicalFieldsAndPreserveBaseFilters()
    {
        foreach (var (name, date, region) in new[]
        {
            ("sales", "OrderDate", "SalesTerritory"), ("support", "OpenedAt", "CustomerRegion")
        })
        {
            var dataset = Dataset(name, date, region);
            var baseline = Aggregate(name) with
            {
                Filters = [new QueryFilter("paid", QueryOperator.Equal,
                    [new QueryScalar(QueryValueType.Boolean, Boolean: true)])]
            };
            var plan = DashboardFilterPlanner.Plan(DataSourceProvider.Sqlite, dataset, baseline, Context());
            var filters = plan.Request.Filters!;
            Assert.Multiple(() =>
            {
                Assert.That(filters.Select(f => f.Field), Is.EqualTo(new[] { "paid", date, date, region }));
                Assert.That(filters.Select(f => f.Operator), Is.EqualTo(new[]
                {
                    QueryOperator.Equal, QueryOperator.GreaterThanOrEqual, QueryOperator.LessThan, QueryOperator.Equal
                }));
                Assert.That(filters[1].Values![0].Timestamp!.Value.Offset, Is.EqualTo(TimeSpan.Zero));
                Assert.That(filters[1].Values![0].Timestamp, Is.EqualTo(Start.ToUniversalTime()));
                Assert.That(filters[2].Values![0].Timestamp, Is.EqualTo(End));
                Assert.That(plan.Outcomes.Select(x => x.Applicability), Is.All.EqualTo(FilterApplicability.Applied));
                Assert.That(baseline.Filters, Has.Count.EqualTo(1));
                Assert.That(plan.Request.Aggregates, Is.EqualTo(baseline.Aggregates));
            });
        }
    }

    [Test]
    public void MissingMappingNeverGuessesFromFieldNameAndResetKeepsBasePredicate()
    {
        var dataset = Dataset("sales", "OrderDate", Region);
        dataset = dataset with
        {
            Fields = dataset.Fields.Select(f => f with { BusinessDimension = null }).ToArray()
        };
        var query = Aggregate("sales") with { Filters = [new QueryFilter("paid", QueryOperator.IsNotNull)] };
        var plan = DashboardFilterPlanner.Plan(DataSourceProvider.Sqlite, dataset, query, Context());
        Assert.That(plan.Outcomes.Select(x => x.Applicability), Is.All.EqualTo(FilterApplicability.NoApprovedMapping));
        Assert.That(plan.Request.Filters, Is.EqualTo(query.Filters));
        var cleared = DashboardFilterPlanner.Plan(DataSourceProvider.Sqlite, dataset, query, new());
        Assert.That(cleared.Request.Filters, Is.EqualTo(query.Filters));
        Assert.That(cleared.Outcomes, Is.Empty);
    }

    [Test]
    public void MappingPermissionTypeAndProviderLimitAreDistinct()
    {
        var dataset = Dataset("sales", "OrderDate", "SalesTerritory");
        var blocked = dataset with { Fields = dataset.Fields.Select(f => f.BusinessDimension == Region
            ? f with { Filterable = false } : f).ToArray() };
        var mismatched = dataset with { Fields = dataset.Fields.Select(f => f.BusinessDimension == Region
            ? f with { Type = QueryValueType.Number } : f).ToArray() };
        var substring = new SharedDashboardFilters(Fields: [Selected() with { Operator = QueryOperator.Contains }]);
        Assert.That(DashboardFilterPlanner.Plan(DataSourceProvider.Sqlite, blocked, Aggregate("sales"), Context())
            .Outcomes[1].Applicability, Is.EqualTo(FilterApplicability.FieldNotFilterable));
        Assert.That(DashboardFilterPlanner.Plan(DataSourceProvider.Sqlite, mismatched, Aggregate("sales"), Context())
            .Outcomes[1].Applicability, Is.EqualTo(FilterApplicability.IncompatibleType));
        Assert.That(DashboardFilterPlanner.Plan(DataSourceProvider.Elasticsearch, dataset, Aggregate("sales"), substring)
            .Outcomes.Single().Applicability, Is.EqualTo(FilterApplicability.UnsupportedOperator));
        Assert.That(DashboardFilterPlanner.Plan(DataSourceProvider.Sqlite, dataset, Aggregate("sales"), substring)
            .Outcomes.Single().Applicability, Is.EqualTo(FilterApplicability.Applied));
    }

    [Test]
    public void InvalidSelectionsAndAmbiguousMappingsFailClosedEvenWithoutApplicableFields()
    {
        var dataset = Dataset("sales", "OrderDate", "SalesTerritory");
        var empty = dataset with { Fields = dataset.Fields.Select(f => f with { BusinessDimension = null }).ToArray() };
        var query = Aggregate("sales");
        var ambiguous = dataset with { Fields = dataset.Fields.Select(f => f.Name == "paid"
            ? f with { BusinessDimension = Region } : f).ToArray() };
        Assert.Throws<InvalidQueryException>(() => DashboardFilterPlanner.Plan(DataSourceProvider.Sqlite, ambiguous, query, Context()));
        var bad = new SharedDashboardFilters[]
        {
            new(new SharedDateRange(End, Start)), new(new SharedDateRange(Start, Start)),
            new(new SharedDateRange(null, End)),
            new(Fields: [Selected() with { Dimension = "region;DROP" }]),
            new(Fields: [Selected() with { Dimension = DashboardFilterPlanner.ReportingTime }]),
            new(Fields: [Selected() with { Type = QueryValueType.Number }]),
            new(Fields: [Selected() with { Operator = (QueryOperator)99 }]),
            new(Fields: [Selected() with { Values = [] }]),
            new(Fields: Enumerable.Repeat(Selected(), 13).ToArray())
        };
        foreach (var context in bad)
            Assert.Throws<InvalidQueryException>(() => DashboardFilterPlanner.Plan(DataSourceProvider.Sqlite, empty, query, context));
        var crowded = query with { Filters = Enumerable.Repeat(new QueryFilter("paid", QueryOperator.IsNotNull), 11).ToArray() };
        Assert.Throws<InvalidQueryException>(() => DashboardFilterPlanner.Plan(DataSourceProvider.Sqlite, dataset, crowded, Context()));
    }

    [Test]
    public void JsonTimeRequiresExplicitOffset()
    {
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<SharedDateRange>(
            """{"Start":"2026-11-15T08:30:00","End":"2026-11-16T01:00:00Z"}"""));
        var range = JsonSerializer.Deserialize<SharedDateRange>(
            """{"Start":"2026-11-15T08:30:00-08:00","End":"2026-11-16T01:00:00Z"}""");
        Assert.That(range!.Start, Is.EqualTo(Start));
    }

    [TestCase(DataSourceProvider.SqlServer)]
    [TestCase(DataSourceProvider.PostgreSql)]
    [TestCase(DataSourceProvider.MySql)]
    [TestCase(DataSourceProvider.Sqlite)]
    public void SharedPredicatesCompileToBoundWhereBeforeGrouping(DataSourceProvider provider)
    {
        var dataset = Dataset("sales", "OrderDate", "SalesTerritory");
        var request = new QueryRequest("sales", ["SalesTerritory"], GroupBy: ["SalesTerritory"],
            Aggregates: [new QueryAggregate("total", QueryAggregateFunction.Sum, "amount")]);
        var plan = DashboardFilterPlanner.Plan(provider, dataset, request, Context(Attack));
        RelationalQueryCompiler compiler = provider switch
        {
            DataSourceProvider.SqlServer => new SqlServerQueryCompiler(),
            DataSourceProvider.PostgreSql => new PostgreSqlQueryCompiler(),
            DataSourceProvider.MySql => new MySqlQueryCompiler(),
            _ => new SqliteQueryCompiler()
        };
        var compiled = compiler.Compile(new RelationalDatasetBinding(dataset, "fixture", "sales", "id"), plan.Request);
        Assert.Multiple(() =>
        {
            Assert.That(compiled.CommandText, Does.Contain("OrderDate").And.Contain(" >= @p0").And.Contain(" < @p1"));
            Assert.That(compiled.CommandText.IndexOf(" WHERE ", StringComparison.Ordinal),
                Is.LessThan(compiled.CommandText.IndexOf(" GROUP BY ", StringComparison.Ordinal)));
            Assert.That(compiled.CommandText, Does.Not.Contain(Attack));
            Assert.That(compiled.Parameters.Select(p => p.Value), Is.EqualTo(new object[] { Start.ToUniversalTime(), End, Attack }));
        });
    }

    [Test]
    public void ElasticsearchUsesApprovedPhysicalPathsAndStructuredFilterBeforeMetrics()
    {
        var dataset = Dataset("support", "OpenedAt", "CustomerRegion");
        var fields = dataset.Fields.ToDictionary(f => f.Name, f => new ElasticsearchFieldBinding(
            f.Name == "CustomerRegion" ? "customer.region.keyword" : f.Name == "OpenedAt" ? "event.opened" : f.Name,
            f.Name, f.Type == QueryValueType.Text));
        var plan = DashboardFilterPlanner.Plan(DataSourceProvider.Elasticsearch, dataset, Aggregate("support"), Context(Attack));
        var compiled = new ElasticsearchQueryCompiler().Compile(
            new ElasticsearchDatasetBinding(dataset, "support", "id", fields, true), plan.Request);
        using var json = JsonDocument.Parse(compiled.RequestBody);
        var root = json.RootElement;
        var filters = root.GetProperty("query").GetProperty("bool").GetProperty("filter");
        Assert.Multiple(() =>
        {
            Assert.That(filters.GetArrayLength(), Is.EqualTo(3));
            Assert.That(filters[0].GetProperty("range").GetProperty("event.opened").GetProperty("gte").GetString(),
                Is.EqualTo("2026-11-15T16:30:00.0000000Z"));
            Assert.That(filters[1].GetProperty("range").GetProperty("event.opened").GetProperty("lt").GetString(),
                Is.EqualTo("2026-11-16T01:00:00.0000000Z"));
            Assert.That(filters[2].GetProperty("term").GetProperty("customer.region.keyword").GetProperty("value").GetString(),
                Is.EqualTo(Attack));
            Assert.That(root.GetProperty("aggs").GetProperty("total").GetProperty("sum").GetProperty("field").GetString(),
                Is.EqualTo("amount"));
        });
    }

    [Test]
    public void DisposableSqliteAggregatesOnlyRowsInsideHalfOpenRangeAndMatchingRegion()
    {
        var dataset = Dataset("sales", "OrderDate", "SalesTerritory");
        using var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        using (var setup = connection.CreateCommand())
        {
            setup.CommandText = """
                CREATE TABLE sales (id INTEGER PRIMARY KEY, OrderDate TEXT COLLATE BINARY, SalesTerritory TEXT, amount NUMERIC, paid INTEGER);
                INSERT INTO sales VALUES
                  (1,'2026-11-15T16:29:59.9999999Z','Pacific',100,1),
                  (2,'2026-11-15T16:30:00.0000000Z','Pacific',12,1),
                  (3,'2026-11-16T00:59:59.9999999Z','Pacific',8,1),
                  (4,'2026-11-16T01:00:00.0000000Z','Pacific',100,1),
                  (5,'2026-11-15T18:00:00.0000000Z','Other',100,1);
                PRAGMA query_only=ON;
                """;
            setup.ExecuteNonQuery();
        }
        var planned = DashboardFilterPlanner.Plan(DataSourceProvider.Sqlite, dataset, Aggregate("sales"), Context());
        var compiled = new SqliteQueryCompiler().Compile(new RelationalDatasetBinding(dataset, "main", "sales", "id"), planned.Request);
        using var command = SqliteCommandFactory.Create(connection, compiled);
        using var reader = command.ExecuteReader();
        Assert.That(reader.Read(), Is.True);
        Assert.That(Convert.ToDouble(reader.GetValue(0)), Is.EqualTo(20));
        Assert.That(reader.GetInt64(1), Is.EqualTo(2));
        Assert.That(reader.Read(), Is.False);
    }
}
