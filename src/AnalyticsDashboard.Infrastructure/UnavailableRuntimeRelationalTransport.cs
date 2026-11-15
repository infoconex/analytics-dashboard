using System.Data.Common;
using AnalyticsDashboard.Application;

namespace AnalyticsDashboard.Infrastructure;

/// <summary>
/// Deployed fail-closed adapter. No configuration switch can enable customer sockets.
/// Replace only after proving full broker/driver, egress, TLS and KMS controls.
/// </summary>
public sealed class UnavailableRuntimeRelationalTransport : IRuntimeRelationalTransport
{
    public Task EnsureReadyAsync(CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        throw new ConnectionSecurityUnavailableException();
    }

    public Task<DbConnection> OpenAsync(RuntimeRelationalConnection request, string credential,
        CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        throw new ConnectionSecurityUnavailableException();
    }
}
