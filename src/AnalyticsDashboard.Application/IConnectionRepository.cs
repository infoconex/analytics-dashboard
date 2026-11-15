namespace AnalyticsDashboard.Application;

public interface IConnectionRepository
{
    Task<ConnectionProfile?> FindAsync(string organizationId, Guid dataSourceId, CancellationToken token);
    Task<bool> SaveAsync(ConnectionProfile profile, int expectedRevision,
        string actor, string action, CancellationToken token);
    Task<bool> DeleteAsync(string organizationId, Guid dataSourceId, int expectedRevision,
        string actor, CancellationToken token);
}
