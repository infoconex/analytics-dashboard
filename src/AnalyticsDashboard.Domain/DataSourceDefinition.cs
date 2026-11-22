namespace AnalyticsDashboard.Domain;

/// <summary>
/// Tenant-owned registration metadata. This is not a connection or an executable data source.
/// </summary>
public sealed record DataSourceDefinition(
    Guid Id,
    string OrganizationId,
    string Name,
    DataSourceProvider Provider,
    int Revision,
    string CreatedBy,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
