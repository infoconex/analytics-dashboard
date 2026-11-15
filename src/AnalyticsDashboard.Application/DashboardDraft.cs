using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

public sealed record DashboardDraft(
    string Name,
    string Description,
    IReadOnlyList<DashboardWidget> Widgets);
