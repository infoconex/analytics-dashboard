using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Infrastructure;

/// <summary>Value and type to bind using a native provider command parameter.</summary>
public sealed record CompiledQueryParameter(string Name, QueryValueType Type, object Value);
