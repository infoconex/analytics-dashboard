using System.Text.Json.Serialization;

namespace AnalyticsDashboard.Domain;

/// <summary>Bounded semantic shape over approved fictional records, never an execution request.</summary>
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record FictionalQueryDefinition(
    string Dataset,
    string Visualization,
    string GroupByDimension,
    string Aggregate,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? MeasureDimension = null);
