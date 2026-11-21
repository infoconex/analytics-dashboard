namespace AnalyticsDashboard.Domain;

/// <summary>Optional, bounded chart presentation metadata. Null fields mean legacy defaults.</summary>
public sealed record VisualizationAppearance(
    bool? ShowLegend = null,
    bool? ShowSliceLabels = null,
    int? MaxSliceLabels = null,
    int? HistogramBins = null,
    string? CategorySort = null);
