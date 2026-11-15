namespace AnalyticsDashboard.Domain;

public sealed record DashboardWidget(
    Guid Id,
    string Title,
    VisualizationKind Kind,
    string DatasetKey,
    string MetricKey,
    string DimensionKey);
