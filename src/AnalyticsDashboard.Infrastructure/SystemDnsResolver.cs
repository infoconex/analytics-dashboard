using System.Net;
using AnalyticsDashboard.Application;

namespace AnalyticsDashboard.Infrastructure;

public sealed class SystemDnsResolver : IDnsResolver
{
    public Task<IPAddress[]> ResolveAsync(string host, CancellationToken token) =>
        Dns.GetHostAddressesAsync(host, token);
}
