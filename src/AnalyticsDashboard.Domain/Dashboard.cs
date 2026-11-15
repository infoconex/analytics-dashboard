namespace AnalyticsDashboard.Domain;

public sealed record Dashboard(
    Guid Id,
    string OrganizationId,
    string Name,
    string Description,
    IReadOnlyList<DashboardWidget> Widgets,
    int Revision,
    string CreatedBy,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
