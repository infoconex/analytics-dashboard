namespace AnalyticsDashboard.Domain;

/// <summary>Trusted server-side allowlist metadata, never taken from the query request.</summary>
public sealed record QueryField(
    string Name,
    QueryValueType Type,
    bool Filterable = true,
    bool Groupable = true,
    bool Sortable = true,
    bool Aggregatable = true,
    string? BusinessDimension = null);
