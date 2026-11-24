using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Infrastructure;

/// <summary>Inert validated Query DSL, not an HTTP request or execution authorization.</summary>
public sealed class CompiledElasticsearchQuery
{
    internal CompiledElasticsearchQuery(string index, string requestBody,
        IReadOnlyList<QueryColumn> columns, int limit, int offset)
    {
        Index = index;
        RequestBody = requestBody;
        Columns = columns;
        Limit = limit;
        Offset = offset;
    }

    public string Index { get; }
    public string RequestBody { get; }
    public IReadOnlyList<QueryColumn> Columns { get; }
    public int Limit { get; }
    public int Offset { get; }
}
