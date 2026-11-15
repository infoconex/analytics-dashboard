using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Infrastructure;

/// <summary>Inert compiled SQL with separately bound values; no connection or executor.</summary>
public sealed class CompiledRelationalQuery
{
    // A caller outside Infrastructure cannot fabricate a plan with arbitrary SQL.
    internal CompiledRelationalQuery(DataSourceProvider provider, string commandText,
        IReadOnlyList<CompiledQueryParameter> parameters,
        IReadOnlyList<QueryColumn> columns, int limit, int offset)
    {
        Provider = provider;
        CommandText = commandText;
        Parameters = parameters;
        Columns = columns;
        Limit = limit;
        Offset = offset;
    }

    public DataSourceProvider Provider { get; }
    public string CommandText { get; }
    public IReadOnlyList<CompiledQueryParameter> Parameters { get; }
    public IReadOnlyList<QueryColumn> Columns { get; }
    public int Limit { get; }
    public int Offset { get; }
}
