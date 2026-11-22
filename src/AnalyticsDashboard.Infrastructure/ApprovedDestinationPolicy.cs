using System.Net;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Infrastructure;

public sealed class ApprovedDestinationPolicy(
    IReadOnlyDictionary<DataSourceProvider, IReadOnlySet<string>> allowed,
    IDnsResolver dns) : IConnectionDestinationPolicy
{
    public async Task<ApprovedNetworkDestination> ValidateAsync(DataSourceProvider provider,
        NetworkConnectionDetails network, CancellationToken token)
    {
        var host = CanonicalHost(network.Host);
        // Exact allowlists: no wildcards, CIDRs, automatic localhost, or arbitrary ports.
        if (!allowed.TryGetValue(provider, out var entries)
            || !entries.Contains($"{host}:{network.Port}"))
            throw new InvalidConnectionException("Network destination is not approved.");

        IPAddress[] addresses;
        try
        {
            addresses = await dns.ResolveAsync(host, token);
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException)
        {
            throw new InvalidConnectionException("Network destination could not be verified.");
        }
        catch (Exception ex) when (ex is System.Net.Sockets.SocketException or ArgumentException)
        {
            throw new InvalidConnectionException("Network destination could not be verified.");
        }
        if (addresses.Length == 0 || addresses.Length > 16 || addresses.Any(ip => !PublicIpAddress.IsAllowed(ip)))
            throw new InvalidConnectionException("Network destination could not be verified.");
        return new ApprovedNetworkDestination(host, network.Port, addresses);
    }

    public static string CanonicalHost(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 253
            || value != value.Trim() || value.EndsWith('.') || IPAddress.TryParse(value, out _))
            throw new InvalidConnectionException("Invalid network hostname.");
        var host = value.ToLowerInvariant();
        var labels = host.Split('.');
        if (labels.Length < 2 || labels.Any(label => label.Length is < 1 or > 63
            || label[0] == '-' || label[^1] == '-'
            || label.Any(c => !(c is >= 'a' and <= 'z' or >= '0' and <= '9' or '-')))
            || labels[^1] is "local" or "localhost" or "internal" or "invalid" or "test")
            throw new InvalidConnectionException("Invalid network hostname.");
        return host;
    }
}
