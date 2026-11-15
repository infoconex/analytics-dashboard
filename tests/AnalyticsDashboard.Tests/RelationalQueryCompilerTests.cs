using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using AnalyticsDashboard.Infrastructure;
using Microsoft.Data.SqlClient;
using Npgsql;

namespace AnalyticsDashboard.Tests;

public sealed class RelationalQueryCompilerTests
{
    private static readonly QueryDataset Sales = new("sales",
    [
        new QueryField("id", QueryValueType.Number),
        new QueryField("region", QueryValueType.Text),
        new QueryField("amount", QueryValueType.Number),
        new QueryField("paid", QueryValueType.Boolean),
        new QueryField("date", QueryValueType.Timestamp),
        new QueryField("secret", QueryValueType.Text, Filterable: false,
            Groupable: false, Sortable: false, Aggregatable: false)
    ]);

    private static readonly RelationalDatasetBinding BoundSales =
        new(Sales, "public", "sales", "id");

    [TestCase(DataSourceProvider.SqlServer)]
    [TestCase(DataSourceProvider.PostgreSql)]
    public void UntrustedValuesNeverBecomeSqlText(DataSourceProvider provider)
    {
        const string attack = "'; DROP TABLE sales; -- %_[]";
        var request = new QueryRequest("sales", ["id", "region"],
        [
            new QueryFilter("region", QueryOperator.Contains,
                [new QueryScalar(QueryValueType.Text, Text: attack)]),
            new QueryFilter("amount", QueryOperator.In,
                [new QueryScalar(QueryValueType.Number, Number: 10m),
                    new QueryScalar(QueryValueType.Number, Number: 20m)])
        ], Sort: [new QuerySort("region", QuerySortDirection.Ascending)], Limit: 3, Offset: 2);

        var plan = Compiler(provider).Compile(BoundSales, request);

        Assert.Multiple(() =>
        {
            Assert.That(plan.CommandText, Does.StartWith("SELECT "));
            Assert.That(plan.CommandText, Does.Not.Contain(attack));
            Assert.That(plan.CommandText, Does.Not.Contain("DROP TABLE"));
            Assert.That(plan.CommandText, Does.Contain("@p0"));
            Assert.That(plan.CommandText, Does.Contain("@p1"));
            Assert.That(plan.Parameters.Select(p => p.Name), Is.EqualTo(new[] { "@p0", "@p1", "@p2" }));
            Assert.That(plan.Parameters[0].Value, Is.EqualTo(attack));
            Assert.That(plan.Limit, Is.EqualTo(3));
            Assert.That(plan.Offset, Is.EqualTo(2));
        });
        Assert.That(plan.CommandText, Does.Contain("id")); // Stable ordering tie-breaker
    }

    [TestCase(DataSourceProvider.SqlServer)]
    [TestCase(DataSourceProvider.PostgreSql)]
    public void GroupingAndAggregatesAreRestrictedToTrustedColumns(DataSourceProvider provider)
    {
        var request = new QueryRequest("sales", ["region"],
            [new QueryFilter("paid", QueryOperator.Equal,
                [new QueryScalar(QueryValueType.Boolean, Boolean: true)])],
            GroupBy: ["region"],
            Aggregates: [new QueryAggregate("total", QueryAggregateFunction.Sum, "amount"),
                new QueryAggregate("count", QueryAggregateFunction.Count)],
            Sort: [new QuerySort("total", QuerySortDirection.Descending)]);

        var plan = Compiler(provider).Compile(BoundSales, request);

        Assert.Multiple(() =>
        {
            Assert.That(plan.CommandText, Does.Contain("SUM("));
            Assert.That(plan.CommandText, Does.Contain("COUNT(*)"));
            Assert.That(plan.CommandText, Does.Contain(" GROUP BY "));
            Assert.That(plan.CommandText, Does.Contain(" ORDER BY "));
            Assert.That(plan.Parameters.Single().Value, Is.EqualTo(true));
            Assert.That(plan.Columns.Select(c => c.Name), Is.EqualTo(new[] { "region", "total", "count" }));
        });
    }

    [TestCase(DataSourceProvider.SqlServer)]
    [TestCase(DataSourceProvider.PostgreSql)]
    public void TimestampParametersNormalizeToUtc(DataSourceProvider provider)
    {
        var timestamp = new DateTimeOffset(2026, 11, 15, 8, 30, 0, TimeSpan.FromHours(-8));
        var request = new QueryRequest("sales", ["id"],
        [new QueryFilter("date", QueryOperator.GreaterThan,
            [new QueryScalar(QueryValueType.Timestamp, Timestamp: timestamp)])]);

        var plan = Compiler(provider).Compile(BoundSales, request);

        Assert.That(plan.Parameters.Single().Value, Is.EqualTo(timestamp.ToUniversalTime()));
    }

    [TestCase(DataSourceProvider.SqlServer)]
    [TestCase(DataSourceProvider.PostgreSql)]
    public void RejectsInjectedOrMissingPhysicalBinding(DataSourceProvider provider)
    {
        var query = new QueryRequest("sales", ["id"]);
        var compiler = Compiler(provider);
        Assert.Throws<InvalidQueryException>(() => compiler.Compile(
            BoundSales with { Table = "sales;DROP_TABLE" }, query));
        Assert.Throws<InvalidQueryException>(() => compiler.Compile(
            BoundSales with { Schema = "public.public" }, query));
        Assert.Throws<InvalidQueryException>(() => compiler.Compile(
            BoundSales with { StableOrderField = "missing" }, query));
        Assert.Throws<InvalidQueryException>(() => compiler.Compile(
            BoundSales with { Dataset = new QueryDataset("sales",
                [new QueryField("id", QueryValueType.Number),
                    new QueryField("region] DROP TABLE sales", QueryValueType.Text)]) }, query));
    }

    [TestCase(DataSourceProvider.SqlServer)]
    [TestCase(DataSourceProvider.PostgreSql)]
    public void InvalidTypedRequestsFailAtCompilationBoundary(DataSourceProvider provider)
    {
        var compiler = Compiler(provider);
        var invalidRequests = new[]
        {
            new QueryRequest("sales", ["id;DELETE"]),
            new QueryRequest("missing", ["id"]),
            new QueryRequest("sales", ["secret"],
                [new QueryFilter("secret", QueryOperator.Equal,
                    [new QueryScalar(QueryValueType.Text, Text: "x")])]),
            new QueryRequest("sales", ["id"],
                [new QueryFilter("id", QueryOperator.Equal,
                    [new QueryScalar(QueryValueType.Text, Text: "1")])]),
            new QueryRequest("sales", ["id"], Limit: 501),
            new QueryRequest("sales", ["id"], Offset: 5001),
            new QueryRequest("sales", ["id", "id"]),
            new QueryRequest("sales", ["id"],
                Sort: [new QuerySort("secret", QuerySortDirection.Ascending)])
        };

        foreach (var query in invalidRequests)
            Assert.Throws<InvalidQueryException>(() => compiler.Compile(BoundSales, query));
    }

    [TestCase(DataSourceProvider.SqlServer)]
    [TestCase(DataSourceProvider.PostgreSql)]
    public void NonSortableGroupingAndAggregateOffsetFail(DataSourceProvider provider)
    {
        var compiler = Compiler(provider);
        var groupSchema = new QueryDataset("sales",
        [
            new QueryField("id", QueryValueType.Number),
            new QueryField("region", QueryValueType.Text, Sortable: false)
        ]);
        var group = new QueryRequest("sales", ["region"], GroupBy: ["region"]);
        Assert.Throws<InvalidQueryException>(() => compiler.Compile(
            BoundSales with { Dataset = groupSchema }, group));

        var aggregate = new QueryRequest("sales", [],
            Aggregates: [new QueryAggregate("count", QueryAggregateFunction.Count)], Offset: 1);
        Assert.Throws<InvalidQueryException>(() => compiler.Compile(BoundSales, aggregate));
    }

    [Test]
    public void NativeCommandFactoriesRejectForeignPlans()
    {
        var query = new QueryRequest("sales", ["id"]);
        var pgPlan = new PostgreSqlQueryCompiler().Compile(BoundSales, query);
        var sqlPlan = new SqlServerQueryCompiler().Compile(BoundSales, query);
        using var sqlConnection = new SqlConnection();
        using var pgConnection = new NpgsqlConnection();
        Assert.Throws<InvalidQueryException>(() => SqlServerCommandFactory.Create(sqlConnection, pgPlan));
        Assert.Throws<InvalidQueryException>(() => PostgreSqlCommandFactory.Create(pgConnection, sqlPlan));
    }

    private static RelationalQueryCompiler Compiler(DataSourceProvider provider) => provider switch
    {
        DataSourceProvider.SqlServer => new SqlServerQueryCompiler(),
        DataSourceProvider.PostgreSql => new PostgreSqlQueryCompiler(),
        _ => throw new ArgumentOutOfRangeException(nameof(provider))
    };
}
