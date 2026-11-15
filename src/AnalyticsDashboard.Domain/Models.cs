namespace AnalyticsDashboard.Domain;

public enum OrganizationRole
{
    Viewer,
    Editor,
    Owner
}

public enum VisualizationKind
{
    Metric,
    Line,
    Area,
    Bar,
    Donut,
    Table
}

public sealed record Organization(string Id, string Name);

public sealed record Membership(string OrganizationId, string UserId, OrganizationRole Role);

public sealed record DashboardWidget(
    Guid Id,
    string Title,
    VisualizationKind Kind,
    string DatasetKey,
    string MetricKey,
    string DimensionKey);

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
