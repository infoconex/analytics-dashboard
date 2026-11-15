using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace AnalyticsDashboard.Domain;

/// <summary>Requires an unambiguous ISO-8601 timestamp with an explicit UTC offset.</summary>
public sealed class OffsetTimestampConverter : JsonConverter<DateTimeOffset?>
{
    private static readonly Regex Format = new(
        @"\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})\z",
        RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));

    public override DateTimeOffset? Read(ref Utf8JsonReader reader, Type typeToConvert,
        JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null) return null;
        if (reader.TokenType != JsonTokenType.String) throw new JsonException("Invalid timestamp.");

        var raw = reader.GetString();
        if (raw is null || raw.Length > 40 || !Format.IsMatch(raw)
            || !DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind, out var timestamp))
            throw new JsonException("Timestamp requires an ISO-8601 offset.");

        return timestamp;
    }

    public override void Write(Utf8JsonWriter writer, DateTimeOffset? value,
        JsonSerializerOptions options)
    {
        if (value is null) writer.WriteNullValue();
        else writer.WriteStringValue(value.Value.ToString("O", CultureInfo.InvariantCulture));
    }
}
