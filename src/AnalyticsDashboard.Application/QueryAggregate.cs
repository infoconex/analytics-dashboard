using System.Text.Json.Serialization;
using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record QueryAggregate(string Alias, [property: JsonRequired] QueryAggregateFunction Function,
    string? Field = null);
