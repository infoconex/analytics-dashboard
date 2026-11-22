using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

public interface IOrganizationCatalog
{
    Task<IReadOnlyList<(Organization Organization, OrganizationRole Role)>>
        GetOrganizationsAsync(string userId, CancellationToken cancellationToken);

    Task<OrganizationRole?> GetRoleAsync(
        string organizationId, string userId, CancellationToken cancellationToken);
}
