using System.Net;

namespace AnalyticsDashboard.Application;

// Future adapters MUST use these pinned addresses at connect time and TLS-verify Host.
// Approval expires with this validation operation; persisted profiles are NOT connect permits.
public sealed record ApprovedNetworkDestination(string Host, int Port, IReadOnlyList<IPAddress> Addresses);
