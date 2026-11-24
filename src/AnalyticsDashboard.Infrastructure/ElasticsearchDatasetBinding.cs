using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Infrastructure;

/// <summary>Operator-trusted physical mapping; never accepted from an HTTP request.</summary>
public sealed record ElasticsearchFieldBinding(
    string QueryPath,
    string SourcePath,
    bool ExactKeyword = false);

/// <summary>
/// Binds one approved logical dataset to a fixed index and approved physical
/// fields. The non-null unique stable key is a privileged operator obligation.
/// </summary>
public sealed record ElasticsearchDatasetBinding(
    QueryDataset Dataset,
    string Index,
    string StableSortField,
    IReadOnlyDictionary<string, ElasticsearchFieldBinding> Fields,
    bool StableKeyIsUniqueAndPresent);
