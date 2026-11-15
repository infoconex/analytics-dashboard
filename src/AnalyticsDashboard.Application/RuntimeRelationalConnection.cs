using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

/// <summary>
/// A single-attempt transport instruction, not a reusable network authorization token.
/// The transport must connect exclusively to Addresses and authenticate Host via TLS.
/// </summary>
public sealed record RuntimeRelationalConnection(
    string OrganizationId,
    Guid DataSourceId,
    DataSourceProvider Provider,
    NetworkConnectionDetails Network,
    ApprovedNetworkDestination Destination,
    int ProfileRevision);
