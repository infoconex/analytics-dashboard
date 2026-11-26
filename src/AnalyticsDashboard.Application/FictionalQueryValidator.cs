using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

/// <summary>Validates persisted fictional shapes using trusted semantic metadata only.</summary>
public static class FictionalQueryValidator
{
    public const string SourceKey = "fictionalQuery";

    public static void Validate(DashboardWidget widget)
    {
        var query = widget.QueryDefinition;
        if (query is null || widget.DatasetKey != SourceKey || widget.MetricKey != "query"
            || widget.DimensionKey != "query" || widget.Kind != VisualizationKind.Bar
            || widget.Appearance is not null || query.Visualization != "bar")
            throw Invalid();

        // This metadata mirrors only the approved EXP-05 semantic grouping and sum options.
        // It is not registered with the customer dataset catalog or mapped to physical fields.
        (DataSourceProvider Provider, string[] Groups, string? Measure)? metadata = query.Dataset switch
        {
            "sales" => (DataSourceProvider.SqlServer, ["customer_id", "order_status", "service_tier"], "amount"),
            "support" => (DataSourceProvider.PostgreSql, ["customer_id", "order_status"], null),
            "renewals" => (DataSourceProvider.Elasticsearch, ["order_status"], "amount"),
            "inventory" => (DataSourceProvider.Sqlite, ["category"], "stock_value"),
            _ => null
        };
        if (metadata is not { } approved || !approved.Groups.Contains(query.GroupByDimension, StringComparer.Ordinal)
            || (query.Aggregate == "count" ? query.MeasureDimension is not null
                : query.Aggregate != "sum" || approved.Measure is null || query.MeasureDimension != approved.Measure))
            throw Invalid();

        var fields = approved.Groups.Select(group => new QueryField(group, QueryValueType.Text)).ToList();
        if (approved.Measure is not null)
            fields.Add(new QueryField(approved.Measure, QueryValueType.Number, Groupable: false));
        var dataset = new QueryDataset(query.Dataset, fields);
        var request = new QueryRequest(query.Dataset, Projection: [query.GroupByDimension],
            GroupBy: [query.GroupByDimension], Aggregates:
            [new QueryAggregate("result_value", query.Aggregate == "count"
                ? QueryAggregateFunction.Count : QueryAggregateFunction.Sum, query.MeasureDimension)]);
        try { QueryShapeValidator.Validate(approved.Provider, dataset, request); }
        catch (InvalidQueryException) { throw Invalid(); }
    }

    private static InvalidDashboardException Invalid() =>
        new("Unsupported bounded fictional query visualization definition.");
}
