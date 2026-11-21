using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

public sealed record SavedVisualizationDraft(string Description, DashboardWidget Definition);
public sealed record SavedVisualizationUpdate(string Description, DashboardWidget Definition, int ExpectedRevision);
