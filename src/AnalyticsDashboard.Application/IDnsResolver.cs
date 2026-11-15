using System.Net;

namespace AnalyticsDashboard.Application;

public interface IDnsResolver
{
    Task<IPAddress[]> ResolveAsync(string host, CancellationToken token);
}
