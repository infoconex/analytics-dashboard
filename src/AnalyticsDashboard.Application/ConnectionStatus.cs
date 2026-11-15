using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

// Intentionally excludes hostnames, usernames, database names, paths and encrypted secret fields.
public sealed record ConnectionStatus(DataSourceProvider Provider, bool HasCredential,
    int Revision, DateTimeOffset ConfiguredAt, string Kind);
