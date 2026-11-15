using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Infrastructure;

/// <summary>Operator-supplied, trusted physical binding; never constructed from an HTTP body.</summary>
public sealed record RelationalDatasetBinding(
    QueryDataset Dataset,
    string Schema,
    string Table,
    string StableOrderField);
