using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

/// <summary>Validation is advisory: not an execution grant or a query result.</summary>
public sealed record QueryValidationResult(
    string Dataset,
    DataSourceProvider Provider,
    IReadOnlyList<QueryColumn> Columns,
    int Limit,
    int Offset,
    int Complexity,
    QueryBudget Budget,
    bool Executable = false);
