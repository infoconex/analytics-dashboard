using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

public interface ISavedVisualizationRepository
{
    Task<IReadOnlyList<SavedVisualization>> ListAsync(string organizationId, CancellationToken token);
    Task<SavedVisualization?> FindAsync(string organizationId, Guid id, CancellationToken token);
    Task AddAsync(SavedVisualization definition, CancellationToken token);
    Task<bool> ReplaceAsync(SavedVisualization definition, int expectedRevision, CancellationToken token);
    Task<bool> DeleteAsync(string organizationId, Guid id, int expectedRevision, CancellationToken token);
}
