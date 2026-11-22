namespace AnalyticsDashboard.Domain;

/// <summary>A reusable, organization-owned template. Dashboards always receive independent copies.</summary>
public sealed record SavedVisualization(
    Guid Id,
    string OrganizationId,
    string Description,
    DashboardWidget Definition,
    int Revision,
    string CreatedBy,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
