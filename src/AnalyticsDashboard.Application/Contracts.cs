using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

public interface IOrganizationCatalog
{
    Task<IReadOnlyList<(Organization Organization, OrganizationRole Role)>>
        GetOrganizationsAsync(string userId, CancellationToken cancellationToken);

    Task<OrganizationRole?> GetRoleAsync(
        string organizationId, string userId, CancellationToken cancellationToken);
}

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

public sealed record DashboardDraft(
    string Name,
    string Description,
    IReadOnlyList<DashboardWidget> Widgets);

public sealed class ForbiddenException : Exception;

public sealed class ConflictException : Exception;

public sealed class InvalidDashboardException(string message) : Exception(message);
