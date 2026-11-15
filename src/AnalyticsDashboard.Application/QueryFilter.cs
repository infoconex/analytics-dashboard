using System.Text.Json.Serialization;
using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

/// <summary>Filters are combined with AND. Arbitrary predicate trees are not accepted.</summary>
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record QueryFilter(string Field, [property: JsonRequired] QueryOperator Operator,
    IReadOnlyList<QueryScalar>? Values = null);
