using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

public interface IConnectionSecretProtector
{
    ProtectedConnectionSecret Protect(string value, string organizationId, Guid dataSourceId,
        DataSourceProvider provider);
    string Unprotect(ProtectedConnectionSecret value, string organizationId, Guid dataSourceId,
        DataSourceProvider provider);
}
