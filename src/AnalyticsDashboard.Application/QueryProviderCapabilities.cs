using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

/// <summary>Conservative planning capabilities, pending adapter conformance tests.</summary>
public sealed record QueryProviderCapabilities(
    DataSourceProvider Provider,
    IReadOnlySet<QueryOperator> Operators,
    IReadOnlySet<QueryAggregateFunction> Aggregates)
{
    private static readonly IReadOnlySet<QueryOperator> CommonOperators = new HashSet<QueryOperator>
    {
        QueryOperator.Equal, QueryOperator.NotEqual, QueryOperator.GreaterThan,
        QueryOperator.GreaterThanOrEqual, QueryOperator.LessThan, QueryOperator.LessThanOrEqual,
        QueryOperator.In, QueryOperator.IsNull, QueryOperator.IsNotNull
    };

    private static readonly IReadOnlySet<QueryOperator> RelationalOperators = new HashSet<QueryOperator>(
        CommonOperators.Concat([QueryOperator.Contains, QueryOperator.StartsWith]));

    private static readonly IReadOnlySet<QueryAggregateFunction> CommonAggregates = new HashSet<QueryAggregateFunction>(
        Enum.GetValues<QueryAggregateFunction>());

    public static QueryProviderCapabilities For(DataSourceProvider provider) => provider switch
    {
        DataSourceProvider.SqlServer or DataSourceProvider.MySql or DataSourceProvider.PostgreSql
            or DataSourceProvider.Sqlite => new(provider, RelationalOperators, CommonAggregates),
        DataSourceProvider.Elasticsearch => new(provider, CommonOperators, CommonAggregates),
        _ => throw new InvalidQueryException("Unsupported data-source provider.")
    };
}
