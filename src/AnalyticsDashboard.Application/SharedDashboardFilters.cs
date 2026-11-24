using System.Text.Json.Serialization;
using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

/// <summary>Resolved instants, not local wall-clock values. Display zone and relative presets
/// are resolved once by the future calendar layer, not separately per dataset.</summary>
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record SharedDateRange(
    [property: JsonRequired, JsonConverter(typeof(OffsetTimestampConverter))] DateTimeOffset? Start,
    [property: JsonRequired, JsonConverter(typeof(OffsetTimestampConverter))] DateTimeOffset? End);

/// <summary>Dimension identifiers are semantic, never physical field identifiers.</summary>
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record SharedFieldFilter(
    string Dimension,
    [property: JsonRequired] QueryValueType Type,
    [property: JsonRequired] QueryOperator Operator,
    IReadOnlyList<QueryScalar>? Values = null);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record SharedDashboardFilters(
    SharedDateRange? DateRange = null,
    IReadOnlyList<SharedFieldFilter>? Fields = null);

public enum FilterApplicability
{
    Applied,
    NoApprovedMapping,
    FieldNotFilterable,
    IncompatibleType,
    UnsupportedOperator
}

/// <summary>One outcome per selected filter (date range is one selection).
/// FieldIndex is null for the date selection, otherwise the zero-based input index.</summary>
public sealed record SharedFilterOutcome(string Dimension, int? FieldIndex, FilterApplicability Applicability);

/// <summary>Non-executable request and scope feedback. Applied means planned, not observed data change.</summary>
public sealed record DashboardFilterPlan(
    QueryRequest Request, IReadOnlyList<SharedFilterOutcome> Outcomes);
