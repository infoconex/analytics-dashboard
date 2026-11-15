using System.Text.Json.Serialization;
using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record DataSourceDraft(string Name, [property: JsonRequired] DataSourceProvider Provider);
