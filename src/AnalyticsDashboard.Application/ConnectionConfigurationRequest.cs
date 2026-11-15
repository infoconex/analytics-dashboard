namespace AnalyticsDashboard.Application;

// A separate, explicitly allowlisted API shape. Registration contracts stay unchanged.
public sealed record ConnectionConfigurationRequest(
    NetworkConnectionRequest? Network,
    SqliteConnectionRequest? Sqlite,
    string? Credential,
    int ExpectedRevision);
