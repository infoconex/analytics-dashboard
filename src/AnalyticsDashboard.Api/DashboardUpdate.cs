using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Api;

public sealed record DashboardUpdate(
    string Name,
    string Description,
    IReadOnlyList<DashboardWidget> Widgets,
    int ExpectedRevision);
