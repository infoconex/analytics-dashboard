using System.Data.Common;

namespace AnalyticsDashboard.Application;

/// <summary>
/// Privileged provider adapter boundary. A production implementation must own the actual
/// socket, TLS verification, independent egress policy and provider session lifecycle.
/// An approved destination alone is never permission to use a provider's DNS resolver.
/// </summary>
public interface IRuntimeRelationalTransport
{
    // Fails unless all independently enforced runtime prerequisites are available.
    // Must not probe the customer destination or retrieve credentials.
    Task EnsureReadyAsync(CancellationToken token);

    // The transport owns cleanup if connection establishment fails or is cancelled.
    Task<DbConnection> OpenAsync(RuntimeRelationalConnection request, string credential,
        CancellationToken token);
}
