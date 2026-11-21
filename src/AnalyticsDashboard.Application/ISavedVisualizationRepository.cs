using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

public interface ISavedVisualizationRepository
{
    Task<IReadOnlyList<SavedVisualization>> ListVisualizationsAsync(string organizationId, CancellationToken token);
    Task<SavedVisualization?> FindVisualizationAsync(string organizationId, Guid id, CancellationToken token);
    Task AddVisualizationAsync(SavedVisualization definition, CancellationToken token);
    Task<bool> ReplaceVisualizationAsync(SavedVisualization definition, int expectedRevision, CancellationToken token);
    Task<bool> DeleteVisualizationAsync(string organizationId, Guid id, int expectedRevision, CancellationToken token);
}
