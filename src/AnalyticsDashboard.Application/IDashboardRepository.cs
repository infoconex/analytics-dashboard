using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

public interface IDashboardRepository
{
    Task<IReadOnlyList<Dashboard>> ListAsync(string organizationId, CancellationToken cancellationToken);

    Task<Dashboard?> FindAsync(
        string organizationId, Guid dashboardId, CancellationToken cancellationToken);

    Task AddAsync(Dashboard dashboard, CancellationToken cancellationToken);

    Task<bool> ReplaceAsync(
        Dashboard dashboard, int expectedRevision, CancellationToken cancellationToken);

    Task<bool> DeleteAsync(
        string organizationId, Guid dashboardId, CancellationToken cancellationToken);
}
