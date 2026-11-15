using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

public interface IConnectionDestinationPolicy
{
    Task<ApprovedNetworkDestination> ValidateAsync(DataSourceProvider provider,
        NetworkConnectionDetails network, CancellationToken token);
}
