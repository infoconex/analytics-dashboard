using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

public interface IDataSourceRepository
{
    Task<IReadOnlyList<DataSourceDefinition>> ListAsync(string organizationId, CancellationToken cancellationToken);

    Task<DataSourceDefinition?> FindAsync(string organizationId, Guid id, CancellationToken cancellationToken);

    Task AddAsync(DataSourceDefinition definition, CancellationToken cancellationToken);

    Task<bool> ReplaceAsync(DataSourceDefinition definition, int expectedRevision, CancellationToken cancellationToken);

    Task<bool> DeleteAsync(string organizationId, Guid id, int expectedRevision,
        CancellationToken cancellationToken, bool requireUnconfigured = false);
}
