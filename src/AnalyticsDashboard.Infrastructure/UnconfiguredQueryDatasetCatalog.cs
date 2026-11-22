using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Infrastructure;

/// <summary>Fail closed: no schema registration or real customer datasets are available yet.</summary>
public sealed class UnconfiguredQueryDatasetCatalog : IQueryDatasetCatalog
{
    public Task<QueryDataset?> FindAsync(string organizationId, Guid dataSourceId, string dataset,
        CancellationToken cancellationToken) => Task.FromResult<QueryDataset?>(null);
}
