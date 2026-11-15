using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

/// <summary>Trusted schema allowlist, scoped to both organization and registered data source.</summary>
public interface IQueryDatasetCatalog
{
    Task<QueryDataset?> FindAsync(string organizationId, Guid dataSourceId, string dataset,
        CancellationToken cancellationToken);
}
