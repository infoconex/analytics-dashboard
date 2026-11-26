using System.Text.Json.Serialization;

namespace AnalyticsDashboard.Domain;

public sealed record DashboardWidget(
    Guid Id,
    string Title,
    VisualizationKind Kind,
    string DatasetKey,
    string MetricKey,
    string DimensionKey,
    int? Columns = null,
    int? Height = null,
    VisualizationAppearance? Appearance = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] FictionalQueryDefinition? QueryDefinition = null);
