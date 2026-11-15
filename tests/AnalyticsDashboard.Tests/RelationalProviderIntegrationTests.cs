using System.Data.Common;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using AnalyticsDashboard.Infrastructure;
using Microsoft.Data.SqlClient;
using Npgsql;

namespace AnalyticsDashboard.Tests;

/// <summary>Runs only against disposable CI/local DBMS instances, never customer systems.</summary>
[TestFixture(DataSourceProvider.SqlServer)]
[TestFixture(DataSourceProvider.PostgreSql)]
[Category("ProviderIntegration")]
[NonParallelizable]
public sealed class RelationalProviderIntegrationTests(DataSourceProvider provider)
{
    private static readonly QueryDataset Sales = new("sales",
    [
        new QueryField("id", QueryValueType.Number),
        new QueryField("region", QueryValueType.Text),
        new QueryField("amount", QueryValueType.Number),
        new QueryField("paid", QueryValueType.Boolean),
        new QueryField("date", QueryValueType.Timestamp)
    ]);

    private readonly RelationalDatasetBinding binding = new(Sales,
        provider == DataSourceProvider.SqlServer ? "dbo" : "public", "sales", "id");
    private DbConnection reader = null!;

    [OneTimeSetUp]
    public async Task SetUpAsync()
    {
        var adminVariable = provider == DataSourceProvider.SqlServer
            ? "ANALYTICS_TEST_SQLSERVER_ADMIN" : "ANALYTICS_TEST_POSTGRES_ADMIN";
        var readerVariable = provider == DataSourceProvider.SqlServer
            ? "ANALYTICS_TEST_SQLSERVER_READER" : "ANALYTICS_TEST_POSTGRES_READER";
        var adminPassword = Environment.GetEnvironmentVariable(adminVariable);
        var readerPassword = Environment.GetEnvironmentVariable(readerVariable);
        if (string.IsNullOrEmpty(adminPassword) || string.IsNullOrEmpty(readerPassword))
            throw new InvalidOperationException("Disposable provider fixture passwords were not supplied.");

        await using var master = Connect("sa", adminPassword, master: true);
        await OpenWithRetryAsync(master);
        // These fixed principals exist only inside the disposable test containers.
        var quotedPassword = readerPassword.Replace("'", "''", StringComparison.Ordinal);
        if (provider == DataSourceProvider.SqlServer)
        {
            await ExecuteAsync(master, "CREATE DATABASE [analytics_fixture]");
            await ExecuteAsync(master,
                $"CREATE LOGIN [analytics_reader] WITH PASSWORD = '{quotedPassword}'");
        }
        else
        {
            await ExecuteAsync(master, $"CREATE ROLE analytics_reader LOGIN PASSWORD '{quotedPassword}'");
            await ExecuteAsync(master, "CREATE DATABASE analytics_fixture");
        }

        await using var setup = Connect("sa", adminPassword, master: false);
        await setup.OpenAsync();
        if (provider == DataSourceProvider.SqlServer)
        {
            await ExecuteAsync(setup, "CREATE TABLE [dbo].[sales] ([id] int PRIMARY KEY, " +
                "[region] nvarchar(100), [amount] decimal(18, 2), [paid] bit, [date] datetimeoffset)");
            await ExecuteAsync(setup, "INSERT INTO [dbo].[sales] VALUES " +
                "(1, N'Pacific_%', 12.50, 1, '2026-11-15T16:30:00+00:00')," +
                "(2, N'Cascade', 8.75, 0, '2026-11-14T12:00:00+00:00')," +
                "(3, N'Pacific_East', 31.00, 1, '2026-11-16T01:00:00+00:00')");
            await ExecuteAsync(setup, "CREATE USER [analytics_reader] FOR LOGIN [analytics_reader]");
            await ExecuteAsync(setup, "GRANT SELECT ON OBJECT::[dbo].[sales] TO [analytics_reader]");
        }
        else
        {
            await ExecuteAsync(setup, "CREATE TABLE public.sales (id integer PRIMARY KEY, " +
                "region text, amount numeric(18,2), paid boolean, date timestamptz)");
            await ExecuteAsync(setup, "INSERT INTO public.sales VALUES " +
                "(1, 'Pacific_%', 12.50, TRUE, '2026-11-15T16:30:00Z')," +
                "(2, 'Cascade', 8.75, FALSE, '2026-11-14T12:00:00Z')," +
                "(3, 'Pacific_East', 31.00, TRUE, '2026-11-16T01:00:00Z')");
            await ExecuteAsync(setup, "GRANT CONNECT ON DATABASE analytics_fixture TO analytics_reader");
            await ExecuteAsync(setup, "GRANT USAGE ON SCHEMA public TO analytics_reader");
            await ExecuteAsync(setup, "GRANT SELECT ON TABLE public.sales TO analytics_reader");
        }

        reader = Connect("analytics_reader", readerPassword, master: false);
        await reader.OpenAsync();
    }

    [OneTimeTearDown]
    public async Task TearDownAsync()
    {
        if (reader is not null) await reader.DisposeAsync();
    }

    [Test]
    public async Task NativeCommandExecutesLiteralPrefixAndPagination()
    {
        var query = new QueryRequest("sales", ["id", "region"],
            [new QueryFilter("region", QueryOperator.StartsWith,
                [new QueryScalar(QueryValueType.Text, Text: "Pacific_%")])],
            Sort: [new QuerySort("id", QuerySortDirection.Descending)], Limit: 2);
        await using var command = CreateCompiledCommand(query);
        await using var rows = await command.ExecuteReaderAsync();
        Assert.That(await rows.ReadAsync(), Is.True);
        Assert.Multiple(() =>
        {
            Assert.That(rows.GetInt32(0), Is.EqualTo(1));
            Assert.That(rows.GetString(1), Is.EqualTo("Pacific_%"));
        });
        Assert.That(await rows.ReadAsync(), Is.False);
    }

    [Test]
    public async Task InjectionPayloadIsOnlyComparedAsAValue()
    {
        var query = new QueryRequest("sales", ["id"],
            [new QueryFilter("region", QueryOperator.Equal,
                [new QueryScalar(QueryValueType.Text, Text: "' OR 1=1; DROP TABLE sales; --")])]);
        await using var command = CreateCompiledCommand(query);
        await using (var rows = await command.ExecuteReaderAsync())
            Assert.That(await rows.ReadAsync(), Is.False);

        // Confirm the table was not modified even though the attack text was passed.
        await using var count = reader.CreateCommand();
        count.CommandText = provider == DataSourceProvider.SqlServer
            ? "SELECT COUNT(*) FROM [dbo].[sales]" : "SELECT COUNT(*) FROM public.sales";
        Assert.That(Convert.ToInt32(await count.ExecuteScalarAsync()), Is.EqualTo(3));
    }

    [Test]
    public async Task GroupingAndAggregatesExecuteAgainstRealProvider()
    {
        var query = new QueryRequest("sales", ["paid"],
            [new QueryFilter("amount", QueryOperator.GreaterThan,
                [new QueryScalar(QueryValueType.Number, Number: 10m)])],
            GroupBy: ["paid"],
            Aggregates: [new QueryAggregate("total", QueryAggregateFunction.Sum, "amount"),
                new QueryAggregate("count", QueryAggregateFunction.Count)]);
        await using var command = CreateCompiledCommand(query);
        await using var rows = await command.ExecuteReaderAsync();
        Assert.That(await rows.ReadAsync(), Is.True);
        Assert.Multiple(() =>
        {
            Assert.That(rows.GetBoolean(0), Is.True);
            Assert.That(rows.GetDecimal(1), Is.EqualTo(43.50m));
            Assert.That(Convert.ToInt32(rows.GetValue(2)), Is.EqualTo(2));
        });
        Assert.That(await rows.ReadAsync(), Is.False);
    }

    [Test]
    public async Task NativeTimestampParameterUsesUtc()
    {
        var threshold = new DateTimeOffset(2026, 11, 15, 8, 0, 0, TimeSpan.FromHours(-8));
        var query = new QueryRequest("sales", ["id"],
            [new QueryFilter("date", QueryOperator.GreaterThan,
                [new QueryScalar(QueryValueType.Timestamp, Timestamp: threshold)])]);
        await using var command = CreateCompiledCommand(query);
        await using var rows = await command.ExecuteReaderAsync();
        var ids = new List<int>();
        while (await rows.ReadAsync()) ids.Add(rows.GetInt32(0));
        Assert.That(ids, Is.EqualTo(new[] { 1, 3 }));
    }

    [Test]
    public async Task ReadOnlyPrincipalCannotModifyData()
    {
        await using var command = reader.CreateCommand();
        command.CommandText = provider == DataSourceProvider.SqlServer
            ? "DELETE FROM [dbo].[sales]" : "DELETE FROM public.sales";
        try
        {
            await command.ExecuteNonQueryAsync();
            Assert.Fail("Read-only fixture principal unexpectedly modified the table.");
        }
        catch (DbException)
        {
            // Required: real database authorization rejected the mutation.
        }
    }

    private DbCommand CreateCompiledCommand(QueryRequest query)
    {
        var plan = provider == DataSourceProvider.SqlServer
            ? new SqlServerQueryCompiler().Compile(binding, query)
            : new PostgreSqlQueryCompiler().Compile(binding, query);
        return provider == DataSourceProvider.SqlServer
            ? SqlServerCommandFactory.Create((SqlConnection)reader, plan)
            : PostgreSqlCommandFactory.Create((NpgsqlConnection)reader, plan);
    }

    private DbConnection Connect(string user, string password, bool master)
    {
        if (provider == DataSourceProvider.SqlServer)
        {
            var builder = new SqlConnectionStringBuilder
            {
                DataSource = "127.0.0.1,1433",
                InitialCatalog = master ? "master" : "analytics_fixture",
                UserID = user,
                Password = password,
                ConnectTimeout = 4,
                Pooling = false,
                TrustServerCertificate = true // Disposable localhost self-signed test container ONLY.
            };
            builder["Encrypt"] = "True";
            return new SqlConnection(builder.ConnectionString);
        }

        var pg = new NpgsqlConnectionStringBuilder
        {
            Host = "127.0.0.1",
            Port = 5432,
            Database = master ? "postgres" : "analytics_fixture",
            Username = user == "sa" ? "postgres" : user,
            Password = password,
            Timeout = 4,
            Pooling = false,
            SslMode = SslMode.Disable // Disposable localhost test container ONLY.
        };
        return new NpgsqlConnection(pg.ConnectionString);
    }

    private static async Task OpenWithRetryAsync(DbConnection connection)
    {
        for (var attempt = 0; attempt < 50; attempt++)
        {
            try
            {
                await connection.OpenAsync();
                return;
            }
            catch (DbException) when (attempt < 49)
            {
                await Task.Delay(TimeSpan.FromSeconds(2));
            }
        }
    }

    private static async Task ExecuteAsync(DbConnection connection, string statement)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = statement;
        command.CommandTimeout = 20;
        await command.ExecuteNonQueryAsync();
    }
}
