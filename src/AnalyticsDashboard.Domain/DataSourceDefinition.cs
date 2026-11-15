namespace AnalyticsDashboard.Domain;

/// <summary>
/// Tenant-owned connection metadata contract. Connection settings and secrets are not modeled
/// until the secured data-source management capability is implemented.
/// </summary>
public sealed record DataSourceDefinition(
    Guid Id,
    string OrganizationId,
    string Name,
    DataSourceProvider Provider);
