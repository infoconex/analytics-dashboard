namespace AnalyticsDashboard.Domain;

/// <summary>Future adapter response shape; this issue does not populate or return query rows.</summary>
public sealed record QueryResult(
    IReadOnlyList<QueryColumn> Columns,
    IReadOnlyList<IReadOnlyList<QueryScalar?>> Rows,
    int Offset,
    int Limit,
    bool HasMore,
    bool Truncated);
