using System.Text.Json.Serialization;

namespace AnalyticsDashboard.Application;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record DataSourceUpdate(string Name, int ExpectedRevision);
