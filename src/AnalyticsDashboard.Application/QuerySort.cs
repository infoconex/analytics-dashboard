using System.Text.Json.Serialization;
using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record QuerySort(string Field, [property: JsonRequired] QuerySortDirection Direction);
