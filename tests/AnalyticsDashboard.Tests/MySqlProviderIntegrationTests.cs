using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using AnalyticsDashboard.Infrastructure;
using MySqlConnector;

namespace AnalyticsDashboard.Tests;

/// <summary>Runs only against the disposable CI MySQL fixture, never a customer database.</summary>
[TestFixture]
[Category("ProviderIntegration")]
[NonParallelizable]
public sealed class MySqlProviderIntegrationTests
{
    private static readonly QueryDataset Sales = new("sales",
    [
        new QueryField("id", QueryValueType.Number),
        new QueryField("region", QueryValueType.Text),
        new QueryField("amount", QueryValueType.Number),
        new QueryField("paid", QueryValueType.Boolean),
        new QueryField("occurred_at", QueryValueType.Timestamp)
    ]);
    private static readonly RelationalDatasetBinding Bound = new(Sales, "analytics_fixture", "sales", "id");
    private MySqlConnection reader = null!;

    [OneTimeSetUp]
    public async Task SetUpAsync()
    {
        var adminPassword = Environment.GetEnvironmentVariable("ANALYTICS_TEST_MYSQL_ADMIN");
        var readerPassword = Environment.GetEnvironmentVariable("ANALYTICS_TEST_MYSQL_READER");
        if (string.IsNullOrWhiteSpace(adminPassword) || string.IsNullOrWhiteSpace(readerPassword))
            throw new InvalidOperationException("Disposable MySQL test credentials are missing.");

        await using var admin = Connect("root", adminPassword, null);
        for (var attempt = 0; ; attempt++)
        {
            try { await admin.OpenAsync(); break; }
            catch (MySqlException) when (attempt < 49)
            {
                await Task.Delay(TimeSpan.FromSeconds(2));
            }
        }
        await ExecuteAsync(admin, "CREATE DATABASE analytics_fixture CHARACTER SET utf8mb4 COLLATE utf8mb4_bin");
        await ExecuteAsync(admin,
            "CREATE TABLE analytics_fixture.sales (id INTEGER PRIMARY KEY, region VARCHAR(100) COLLATE utf8mb4_bin, " +
            "amount DECIMAL(18,2), paid BOOLEAN, occurred_at DATETIME(6))");
        await ExecuteAsync(admin,
            "INSERT INTO analytics_fixture.sales VALUES " +
            "(1, 'Pacific_%', 12.50, TRUE, '2026-11-15 16:30:00.000000')," +
            "(2, 'Cascade', 8.75, FALSE, '2026-11-14 12:00:00.000000')," +
            "(3, 'Pacific_East', 31.00, TRUE, '2026-11-16 01:00:00.000000')");
        var safePassword = readerPassword.Replace("'", "''", StringComparison.Ordinal);
        await ExecuteAsync(admin, $"CREATE USER 'analytics_reader'@'%' IDENTIFIED BY '{safePassword}'");
        await ExecuteAsync(admin, "GRANT SELECT ON analytics_fixture.sales TO 'analytics_reader'@'%'");

        reader = Connect("analytics_reader", readerPassword, "analytics_fixture");
        await reader.OpenAsync();
    }

    [OneTimeTearDown]
    public async Task TearDownAsync()
    {
        if (reader is not null) await reader.DisposeAsync();
    }

    [Test]
    public async Task TimeAndTextFiltersExecuteBeforeAggregation()
    {
        var start = new DateTimeOffset(2026, 11, 15, 8, 30, 0, TimeSpan.FromHours(-8));
        var query = new QueryRequest("sales", [],
        [
            new QueryFilter("occurred_at", QueryOperator.GreaterThanOrEqual,
                [new QueryScalar(QueryValueType.Timestamp, Timestamp: start)]),
            new QueryFilter("region", QueryOperator.StartsWith,
                [new QueryScalar(QueryValueType.Text, Text: "Pacific_")])
        ], Aggregates:
        [
            new QueryAggregate("total", QueryAggregateFunction.Sum, "amount"),
            new QueryAggregate("count", QueryAggregateFunction.Count)
        ]);
        await using var command = Compile(query);
        await using var rows = await command.ExecuteReaderAsync();
        Assert.That(await rows.ReadAsync(), Is.True);
        Assert.That(rows.GetDecimal(0), Is.EqualTo(43.50m));
        Assert.That(Convert.ToInt64(rows.GetValue(1)), Is.EqualTo(2));
        Assert.That(await rows.ReadAsync(), Is.False);
    }

    [Test]
    public async Task HalfOpenUtcRangeDoesNotIncludeEndBoundary()
    {
        var start = new DateTimeOffset(2026, 11, 15, 8, 30, 0, TimeSpan.FromHours(-8));
        var end = new DateTimeOffset(2026, 11, 16, 1, 0, 0, TimeSpan.Zero);
        var query = new QueryRequest("sales", ["id"],
        [
            new QueryFilter("occurred_at", QueryOperator.GreaterThanOrEqual,
                [new QueryScalar(QueryValueType.Timestamp, Timestamp: start)]),
            new QueryFilter("occurred_at", QueryOperator.LessThan,
                [new QueryScalar(QueryValueType.Timestamp, Timestamp: end)])
        ]);
        await using var command = Compile(query);
        await using var rows = await command.ExecuteReaderAsync();
        Assert.That(await rows.ReadAsync(), Is.True);
        Assert.That(rows.GetInt32(0), Is.EqualTo(1));
        Assert.That(await rows.ReadAsync(), Is.False);
    }

    [Test]
    public async Task LiteralUnderscoreAndStablePagination()
    {
        var query = new QueryRequest("sales", ["id"],
            [new QueryFilter("region", QueryOperator.Contains,
                [new QueryScalar(QueryValueType.Text, Text: "_")])],
            Sort: [new QuerySort("id", QuerySortDirection.Ascending)], Limit: 1, Offset: 1);
        await using var command = Compile(query);
        await using var rows = await command.ExecuteReaderAsync();
        Assert.That(await rows.ReadAsync(), Is.True);
        Assert.That(rows.GetInt32(0), Is.EqualTo(3));
        Assert.That(await rows.ReadAsync(), Is.False);
    }

    [Test]
    public async Task InjectionPayloadRemainsAValue()
    {
        const string attack = "' OR 1=1; DROP TABLE sales; --";
        var query = new QueryRequest("sales", ["id"],
            [new QueryFilter("region", QueryOperator.Equal,
                [new QueryScalar(QueryValueType.Text, Text: attack)])]);
        await using (var command = Compile(query))
        {
            Assert.That(command.CommandText, Does.Not.Contain(attack));
            await using var rows = await command.ExecuteReaderAsync();
            Assert.That(await rows.ReadAsync(), Is.False);
        }
        await using var count = reader.CreateCommand();
        count.CommandText = "SELECT COUNT(*) FROM analytics_fixture.sales";
        Assert.That(Convert.ToInt64(await count.ExecuteScalarAsync()), Is.EqualTo(3));
    }

    [Test]
    public async Task ReadOnlyReaderCannotWrite()
    {
        await using var command = reader.CreateCommand();
        command.CommandText = "DELETE FROM analytics_fixture.sales";
        try
        {
            await command.ExecuteNonQueryAsync();
            Assert.Fail("SELECT-only fixture reader unexpectedly modified the table.");
        }
        catch (MySqlException)
        {
            // Real provider role rejected DML.
        }
    }

    private MySqlCommand Compile(QueryRequest query) =>
        MySqlCommandFactory.Create(reader, new MySqlQueryCompiler().Compile(Bound, query));

    private static MySqlConnection Connect(string user, string password, string? database)
    {
        var options = new MySqlConnectionStringBuilder
        {
            Server = "127.0.0.1",
            Port = 3306,
            UserID = user,
            Password = password,
            Database = database ?? string.Empty,
            ConnectionTimeout = 4,
            Pooling = false,
            SslMode = MySqlSslMode.Disabled // Disposable localhost fixture ONLY; never production.
        };
        return new MySqlConnection(options.ConnectionString);
    }

    private static async Task ExecuteAsync(MySqlConnection connection, string sql)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.CommandTimeout = 20;
        await command.ExecuteNonQueryAsync();
    }
}
