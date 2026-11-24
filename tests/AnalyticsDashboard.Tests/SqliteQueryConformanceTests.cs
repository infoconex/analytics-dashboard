using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using AnalyticsDashboard.Infrastructure;
using Microsoft.Data.Sqlite;

namespace AnalyticsDashboard.Tests;

/// <summary>Runs real SQLite queries in disposable memory, without live connections.</summary>
[TestFixture]
public sealed class SqliteQueryConformanceTests
{
    private static readonly QueryDataset Sales = new("sales",
    [
        new QueryField("id", QueryValueType.Number),
        new QueryField("region", QueryValueType.Text),
        new QueryField("amount", QueryValueType.Number),
        new QueryField("paid", QueryValueType.Boolean),
        new QueryField("date", QueryValueType.Timestamp)
    ]);

    private static readonly RelationalDatasetBinding BoundSales = new(Sales, "main", "sales", "id");
    private SqliteConnection connection = null!;

    [SetUp]
    public void SetUp()
    {
        connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        Execute("CREATE TABLE sales (id INTEGER PRIMARY KEY, region TEXT, amount NUMERIC, paid INTEGER, date TEXT COLLATE BINARY)");
        Execute("INSERT INTO sales VALUES (1, 'Pacific_%', 12.50, 1, '2026-11-15T16:30:00.0000000Z')");
        Execute("INSERT INTO sales VALUES (2, 'Cascade', 8.75, 0, '2026-11-14T12:00:00.0000000Z')");
        Execute("INSERT INTO sales VALUES (3, 'Pacific_East', 31.00, 1, '2026-11-16T01:00:00.0000000Z')");
        Execute("INSERT INTO sales VALUES (4, NULL, 4.50, 0, '2026-11-17T00:00:00.0000000Z')");
        Execute("PRAGMA query_only=ON");
    }

    [TearDown]
    public void TearDown() => connection.Dispose();

    [Test]
    public void TimeAndRegionFiltersRunBeforeAggregation()
    {
        var start = new DateTimeOffset(2026, 11, 15, 8, 30, 0, TimeSpan.FromHours(-8));
        var query = new QueryRequest("sales", [],
        [
            new QueryFilter("date", QueryOperator.GreaterThanOrEqual,
                [new QueryScalar(QueryValueType.Timestamp, Timestamp: start)]),
            new QueryFilter("region", QueryOperator.StartsWith,
                [new QueryScalar(QueryValueType.Text, Text: "Pacific_")])
        ], Aggregates:
        [
            new QueryAggregate("total", QueryAggregateFunction.Sum, "amount"),
            new QueryAggregate("count", QueryAggregateFunction.Count)
        ]);

        using var command = Compile(query);
        Assert.That(command.CommandText, Does.Contain(" WHERE "));
        using var reader = command.ExecuteReader();
        Assert.That(reader.Read(), Is.True);
        Assert.That(Convert.ToDouble(reader.GetValue(0)), Is.EqualTo(43.5).Within(0.0001));
        Assert.That(reader.GetInt64(1), Is.EqualTo(2));
        Assert.That(reader.Read(), Is.False);
    }

    [Test]
    public void HalfOpenUtcBoundsAreExactAcrossInputOffsets()
    {
        var start = new DateTimeOffset(2026, 11, 15, 8, 30, 0, TimeSpan.FromHours(-8));
        var end = new DateTimeOffset(2026, 11, 16, 1, 0, 0, TimeSpan.Zero);
        var query = new QueryRequest("sales", ["id"],
        [
            new QueryFilter("date", QueryOperator.GreaterThanOrEqual,
                [new QueryScalar(QueryValueType.Timestamp, Timestamp: start)]),
            new QueryFilter("date", QueryOperator.LessThan,
                [new QueryScalar(QueryValueType.Timestamp, Timestamp: end)])
        ]);
        using var command = Compile(query);
        Assert.Multiple(() =>
        {
            Assert.That(command.Parameters[0].Value, Is.EqualTo("2026-11-15T16:30:00.0000000Z"));
            Assert.That(command.Parameters[1].Value, Is.EqualTo("2026-11-16T01:00:00.0000000Z"));
        });
        using var reader = command.ExecuteReader();
        Assert.That(reader.Read(), Is.True);
        Assert.That(reader.GetInt64(0), Is.EqualTo(1));
        Assert.That(reader.Read(), Is.False);
    }

    [Test]
    public void UntrustedTextNeverEntersSqlAndCannotModifyData()
    {
        const string attack = "' OR 1=1; DROP TABLE sales; -- %_[";
        var query = new QueryRequest("sales", ["id"],
            [new QueryFilter("region", QueryOperator.Equal,
                [new QueryScalar(QueryValueType.Text, Text: attack)])]);
        using var command = Compile(query);
        Assert.That(command.CommandText, Does.Not.Contain(attack));
        Assert.That(command.Parameters[0].Value, Is.EqualTo(attack));
        using (var reader = command.ExecuteReader())
            Assert.That(reader.Read(), Is.False);
        using var count = connection.CreateCommand();
        count.CommandText = "SELECT COUNT(*) FROM sales";
        Assert.That(Convert.ToInt32(count.ExecuteScalar()), Is.EqualTo(4));
    }

    [Test]
    public void SubstringIsLiteralAndPaginationIsDeterministic()
    {
        var query = new QueryRequest("sales", ["id"],
            [new QueryFilter("region", QueryOperator.Contains,
                [new QueryScalar(QueryValueType.Text, Text: "_")])],
            Sort: [new QuerySort("id", QuerySortDirection.Ascending)],
            Limit: 1, Offset: 1);
        using var command = Compile(query);
        Assert.That(command.CommandText, Does.Contain("instr("));
        using var reader = command.ExecuteReader();
        Assert.That(reader.Read(), Is.True);
        Assert.That(reader.GetInt64(0), Is.EqualTo(3));
        Assert.That(reader.Read(), Is.False);
    }

    [Test]
    public void NullAndBooleanParametersUseNativeSQLiteSemantics()
    {
        var query = new QueryRequest("sales", ["id"],
        [
            new QueryFilter("region", QueryOperator.IsNull),
            new QueryFilter("paid", QueryOperator.Equal,
                [new QueryScalar(QueryValueType.Boolean, Boolean: false)])
        ]);
        using var command = Compile(query);
        Assert.That(command.Parameters[0].SqliteType, Is.EqualTo(SqliteType.Integer));
        Assert.That(command.Parameters[0].Value, Is.EqualTo(0L));
        using var reader = command.ExecuteReader();
        Assert.That(reader.Read(), Is.True);
        Assert.That(reader.GetInt64(0), Is.EqualTo(4));
        Assert.That(reader.Read(), Is.False);
    }

    [Test]
    public void ReadOnlyFixtureRejectsWrites()
    {
        using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM sales";
        Assert.Throws<SqliteException>(() => command.ExecuteNonQuery());
    }

    [Test]
    public void WrongProviderPlanIsRejectedBeforeAnyExecution()
    {
        var pgPlan = new PostgreSqlQueryCompiler().Compile(BoundSales,
            new QueryRequest("sales", ["id"]));
        Assert.Throws<InvalidQueryException>(() => SqliteCommandFactory.Create(connection, pgPlan));
    }

    private SqliteCommand Compile(QueryRequest request)
    {
        var plan = new SqliteQueryCompiler().Compile(BoundSales, request);
        return SqliteCommandFactory.Create(connection, plan);
    }

    private void Execute(string sql)
    {
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.ExecuteNonQuery();
    }
}
