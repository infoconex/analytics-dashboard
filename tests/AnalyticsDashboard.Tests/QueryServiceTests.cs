using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using AnalyticsDashboard.Infrastructure;
using Microsoft.Data.Sqlite;

namespace AnalyticsDashboard.Tests;

public sealed class QueryServiceTests
{
    private string databasePath = null!;
    private SqliteCatalog organizations = null!;
    private SqliteDataSourceRepository sources = null!;
    private FakeDatasetCatalog datasets = null!;
    private QueryService service = null!;
    private Guid sourceId;

    private static readonly QueryDataset Sales = new("sales",
    [
        new QueryField("region", QueryValueType.Text),
        new QueryField("amount", QueryValueType.Number),
        new QueryField("date", QueryValueType.Timestamp),
        new QueryField("paid", QueryValueType.Boolean),
        new QueryField("private_note", QueryValueType.Text, Filterable: false,
            Groupable: false, Sortable: false, Aggregatable: false)
    ]);

    [SetUp]
    public async Task SetUp()
    {
        databasePath = Path.Combine(Path.GetTempPath(), $"analytics-query-{Guid.NewGuid():N}.db");
        organizations = new SqliteCatalog(databasePath);
        await organizations.InitializeAsync();
        await organizations.SeedDevelopmentAsync();
        await using (var connection = new SqliteConnection(new SqliteConnectionStringBuilder
        {
            DataSource = databasePath
        }.ToString()))
        {
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = "INSERT INTO memberships (organization_id, user_id, role) VALUES ($org, $user, $role)";
            command.Parameters.AddWithValue("$org", "northstar");
            command.Parameters.AddWithValue("$user", "test-editor");
            command.Parameters.AddWithValue("$role", (int)OrganizationRole.Editor);
            await command.ExecuteNonQueryAsync();
        }
        sources = new SqliteDataSourceRepository(databasePath);
        await sources.InitializeAsync();
        var dataSource = new DataSourceService(sources, organizations,
            new SqliteConnectionRepository(databasePath), TimeProvider.System);
        sourceId = (await dataSource.CreateAsync("northstar", "demo-owner",
            new DataSourceDraft("Sales reporting", DataSourceProvider.Sqlite), CancellationToken.None)).Id;
        datasets = new FakeDatasetCatalog(sourceId, Sales);
        service = new QueryService(sources, organizations, datasets);
    }

    [TearDown]
    public void TearDown()
    {
        SqliteConnection.ClearAllPools();
        if (File.Exists(databasePath)) File.Delete(databasePath);
    }

    [TestCase("demo-owner")]
    [TestCase("test-editor")]
    [TestCase("demo-viewer")]
    public async Task MembersCanValidateTypedProjectionAndFiltersWithoutExecution(string user)
    {
        var request = new QueryRequest("sales", ["region", "amount"],
        [new QueryFilter("amount", QueryOperator.GreaterThan,
            [new QueryScalar(QueryValueType.Number, Number: 12.5m)])],
            Sort: [new QuerySort("amount", QuerySortDirection.Descending)]);

        var result = await service.ValidateAsync("northstar", sourceId, user, request, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(result?.Executable, Is.False);
            Assert.That(result?.Provider, Is.EqualTo(DataSourceProvider.Sqlite));
            Assert.That(result?.Limit, Is.EqualTo(100));
            Assert.That(result?.Offset, Is.Zero);
            Assert.That(result?.Columns, Is.EqualTo(new[]
            {
                new QueryColumn("region", QueryValueType.Text),
                new QueryColumn("amount", QueryValueType.Number)
            }));
            Assert.That(result?.Budget.MaximumResultBytes, Is.EqualTo(1048576));
            Assert.That(result?.Budget.TimeoutMilliseconds, Is.EqualTo(10000));
            Assert.That(result?.Budget.MaximumConcurrentQueries, Is.EqualTo(2));
        });
    }

    [Test]
    public async Task NonMemberIsRejectedBeforeSourceAndDatasetLookup()
    {
        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await ValidateAsync(Projection(), "isolated", "demo-owner"));
        Assert.That(datasets.Requests, Is.Zero);

        await Assert.ThrowsAsync<ForbiddenException>(async () =>
            await ValidateAsync(Projection(), "northstar", "outsider"));
        Assert.That(datasets.Requests, Is.Zero);
    }

    [Test]
    public async Task GuessedOrForeignSourceNeverReachesDatasetCatalog()
    {
        var result = await service.ValidateAsync("northstar", Guid.NewGuid(), "demo-owner",
            Projection(), CancellationToken.None);
        Assert.That(result, Is.Null);
        Assert.That(datasets.Requests, Is.Zero);
    }

    [Test]
    public void UnallowlistedDatasetOrFieldFailsClosed()
    {
        AssertInvalid(new QueryRequest("unknown", ["amount"]));
        AssertInvalid(new QueryRequest("sales", ["unlisted"]));
        AssertInvalid(new QueryRequest("sales", ["amount", "amount"]));
        AssertInvalid(new QueryRequest("sales", ["amount; DROP TABLE users"]));
        AssertInvalid(new QueryRequest("sales", ["private_note"],
            [new QueryFilter("private_note", QueryOperator.Equal,
                [new QueryScalar(QueryValueType.Text, Text: "private")])]));
    }

    [Test]
    public void InvalidScalarShapesAndOperatorsFail()
    {
        AssertInvalid(WithFilter("amount", QueryOperator.Equal,
            [new QueryScalar(QueryValueType.Text, Text: "12") ]));
        AssertInvalid(WithFilter("amount", QueryOperator.Equal,
            [new QueryScalar(QueryValueType.Number, Text: "12", Number: 12)]));
        AssertInvalid(WithFilter("amount", QueryOperator.Equal,
            [new QueryScalar(QueryValueType.Number)]));
        AssertInvalid(WithFilter("amount", QueryOperator.Equal, []));
        AssertInvalid(WithFilter("amount", QueryOperator.IsNull,
            [new QueryScalar(QueryValueType.Number, Number: 2)]));
        AssertInvalid(WithFilter("amount", QueryOperator.In, []));
        AssertInvalid(WithFilter("paid", QueryOperator.GreaterThan,
            [new QueryScalar(QueryValueType.Boolean, Boolean: true)]));
        AssertInvalid(WithFilter("amount", QueryOperator.Contains,
            [new QueryScalar(QueryValueType.Number, Number: 12)]));
        AssertInvalid(WithFilter("region", (QueryOperator)100,
            [new QueryScalar(QueryValueType.Text, Text: "west")]));
        AssertInvalid(WithFilter("region", QueryOperator.Contains,
            [new QueryScalar(QueryValueType.Text, Text: "")]));
    }

    [Test]
    public async Task ProviderCapabilitiesDifferAndAreEnforced()
    {
        var dataSource = new DataSourceService(sources, organizations,
            new SqliteConnectionRepository(databasePath), TimeProvider.System);
        var elasticId = (await dataSource.CreateAsync("northstar", "demo-owner",
            new DataSourceDraft("Search", DataSourceProvider.Elasticsearch), CancellationToken.None)).Id;
        datasets.AllowedSources.Add(elasticId);
        var request = WithFilter("region", QueryOperator.Contains,
            [new QueryScalar(QueryValueType.Text, Text: "north")]);

        Assert.That(await ValidateAsync(request), Is.Not.Null);
        await Assert.ThrowsAsync<InvalidQueryException>(async () =>
            await service.ValidateAsync("northstar", elasticId, "demo-owner", request,
                CancellationToken.None));
    }

    [Test]
    public async Task GroupedAggregatesReturnTypedColumns()
    {
        var result = await ValidateAsync(new QueryRequest("sales", ["region"],
            GroupBy: ["region"], Aggregates:
            [new QueryAggregate("total", QueryAggregateFunction.Sum, "amount"),
                new QueryAggregate("count", QueryAggregateFunction.Count)],
            Sort: [new QuerySort("total", QuerySortDirection.Descending)]));

        Assert.That(result?.Columns, Is.EqualTo(new[]
        {
            new QueryColumn("region", QueryValueType.Text),
            new QueryColumn("total", QueryValueType.Number),
            new QueryColumn("count", QueryValueType.Number)
        }));
    }

    [Test]
    public void IllegalAggregationMixesAndAliasesFail()
    {
        AssertInvalid(new QueryRequest("sales", ["amount"], Aggregates:
            [new QueryAggregate("count", QueryAggregateFunction.Count)]));
        AssertInvalid(new QueryRequest("sales", ["region"], GroupBy: ["amount"],
            Aggregates: [new QueryAggregate("total", QueryAggregateFunction.Count)]));
        AssertInvalid(new QueryRequest("sales", Aggregates:
            [new QueryAggregate("total", QueryAggregateFunction.Sum, "region")]));
        AssertInvalid(new QueryRequest("sales", Aggregates:
            [new QueryAggregate("first", QueryAggregateFunction.Minimum, "region")]));
        AssertInvalid(new QueryRequest("sales", Aggregates:
            [new QueryAggregate("count", QueryAggregateFunction.Count, "amount")]));
        AssertInvalid(new QueryRequest("sales", ["region"], GroupBy: ["region"], Aggregates:
            [new QueryAggregate("region", QueryAggregateFunction.Count)]));
        AssertInvalid(new QueryRequest("sales", Aggregates:
            [new QueryAggregate("same", QueryAggregateFunction.Count),
                new QueryAggregate("same", QueryAggregateFunction.Count)]));
    }

    [Test]
    public void SortingRequiresAllowlistedOutputFieldsAndPermission()
    {
        AssertInvalid(new QueryRequest("sales", ["region"], Sort:
            [new QuerySort("amount", QuerySortDirection.Ascending)]));
        AssertInvalid(new QueryRequest("sales", ["private_note"], Sort:
            [new QuerySort("private_note", QuerySortDirection.Descending)]));
        AssertInvalid(new QueryRequest("sales", ["region"], Sort:
            [new QuerySort("region", QuerySortDirection.Ascending),
                new QuerySort("region", QuerySortDirection.Descending)]));
        AssertInvalid(new QueryRequest("sales", ["region"], Sort:
            [new QuerySort("region", (QuerySortDirection)99)]));
    }

    [Test]
    public void PaginationAndShapeLimitsAreHardCeilings()
    {
        AssertInvalid(Projection() with { Limit = 0 });
        AssertInvalid(Projection() with { Limit = 501 });
        AssertInvalid(Projection() with { Offset = -1 });
        AssertInvalid(Projection() with { Offset = 5001 });
        AssertInvalid(Projection() with { Filters = Enumerable.Range(0, 13)
            .Select(_ => new QueryFilter("region", QueryOperator.IsNull)).ToArray() });
        AssertInvalid(WithFilter("region", QueryOperator.In, Enumerable.Range(0, 11)
            .Select(i => new QueryScalar(QueryValueType.Text, Text: i.ToString())).ToArray()));
        AssertInvalid(Projection() with { Projection = Enumerable.Repeat("region", 17).ToArray() });
    }

    [Test]
    public void ComplexityBudgetRejectsDenseValidQuery()
    {
        var predicate = new QueryFilter("region", QueryOperator.In, Enumerable.Range(0, 10)
            .Select(i => new QueryScalar(QueryValueType.Text, Text: i.ToString())).ToArray());
        AssertInvalid(new QueryRequest("sales", ["region"],
            Filters: Enumerable.Repeat(predicate, 9).ToArray()));
    }

    [Test]
    public async Task ValidNullAndInOperatorsAndUpperPageLimitAreSupported()
    {
        var result = await ValidateAsync(new QueryRequest("sales", ["region"],
            Filters:
            [new QueryFilter("paid", QueryOperator.IsNotNull),
                new QueryFilter("region", QueryOperator.In,
                [new QueryScalar(QueryValueType.Text, Text: "north"),
                    new QueryScalar(QueryValueType.Text, Text: "south")])],
            Limit: 500, Offset: 5000));
        Assert.Multiple(() =>
        {
            Assert.That(result?.Limit, Is.EqualTo(500));
            Assert.That(result?.Offset, Is.EqualTo(5000));
        });
    }

    private QueryRequest Projection() => new("sales", ["region"]);

    private QueryRequest WithFilter(string field, QueryOperator operation,
        IReadOnlyList<QueryScalar> values) => new("sales", ["region"],
        [new QueryFilter(field, operation, values)]);

    private Task<QueryValidationResult?> ValidateAsync(QueryRequest request,
        string organizationId = "northstar", string userId = "demo-owner") =>
        service.ValidateAsync(organizationId, sourceId, userId, request, CancellationToken.None);

    private void AssertInvalid(QueryRequest request) =>
        Assert.ThrowsAsync<InvalidQueryException>(async () => await ValidateAsync(request));

    private sealed class FakeDatasetCatalog(Guid allowedSource, QueryDataset dataset) : IQueryDatasetCatalog
    {
        public HashSet<Guid> AllowedSources { get; } = [allowedSource];
        public int Requests { get; private set; }

        public Task<QueryDataset?> FindAsync(string organizationId, Guid dataSourceId, string name,
            CancellationToken cancellationToken)
        {
            Requests++;
            return Task.FromResult<QueryDataset?>(organizationId == "northstar"
                && AllowedSources.Contains(dataSourceId) && name == dataset.Name ? dataset : null);
        }
    }
}
