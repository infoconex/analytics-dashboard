using System.Text.Json.Serialization;

namespace AnalyticsDashboard.Application;

/// <summary>Non-executable query specification. There is no SQL, DSL or connection input.</summary>
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record QueryRequest(
    string Dataset,
    IReadOnlyList<string>? Projection = null,
    IReadOnlyList<QueryFilter>? Filters = null,
    IReadOnlyList<string>? GroupBy = null,
    IReadOnlyList<QueryAggregate>? Aggregates = null,
    IReadOnlyList<QuerySort>? Sort = null,
    int? Limit = null,
    int? Offset = null);
