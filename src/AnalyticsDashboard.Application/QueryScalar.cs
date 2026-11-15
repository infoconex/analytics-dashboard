using System.Text.Json.Serialization;
using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

/// <summary>A single typed value. Exactly one corresponding payload must be populated.</summary>
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record QueryScalar(
    [property: JsonRequired] QueryValueType Type,
    string? Text = null,
    decimal? Number = null,
    bool? Boolean = null,
    [property: JsonConverter(typeof(OffsetTimestampConverter))] DateTimeOffset? Timestamp = null);
