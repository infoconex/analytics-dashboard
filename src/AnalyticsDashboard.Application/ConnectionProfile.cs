using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

public sealed record ConnectionProfile(
    string OrganizationId,
    Guid DataSourceId,
    DataSourceProvider Provider,
    NetworkConnectionDetails? Network,
    string? SqliteFileId,
    ProtectedConnectionSecret? Secret,
    int Revision,
    DateTimeOffset ConfiguredAt)
{
    // A revision tombstone survives revocation; stale create requests cannot resurrect secrets.
    public bool IsRevoked => Network is null && SqliteFileId is null;
}
