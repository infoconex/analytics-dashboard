using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

/// <summary>Authorizes and validates query shapes; has no query execution dependency.</summary>
public sealed class QueryService(
    IDataSourceRepository dataSources,
    IOrganizationCatalog organizations,
    IQueryDatasetCatalog datasets)
{
    public async Task<QueryValidationResult?> ValidateAsync(
        string organizationId, Guid dataSourceId, string userId, QueryRequest? request,
        CancellationToken cancellationToken)
    {
        var target = await ResolveAsync(organizationId, dataSourceId, userId, request, cancellationToken);
        return target is { } resolved
            ? QueryShapeValidator.Validate(resolved.Provider, resolved.Dataset, request)
            : null;
    }

    /// <summary>Offline experimental planning only; not exposed by an API or an execution permit.</summary>
    public async Task<DashboardFilterPlan?> PlanDashboardFiltersAsync(
        string organizationId, Guid dataSourceId, string userId, QueryRequest? request,
        SharedDashboardFilters filters, CancellationToken cancellationToken)
    {
        var target = await ResolveAsync(organizationId, dataSourceId, userId, request, cancellationToken);
        return target is { } resolved
            ? DashboardFilterPlanner.Plan(resolved.Provider, resolved.Dataset, request, filters)
            : null;
    }

    private async Task<(DataSourceProvider Provider, QueryDataset? Dataset)?> ResolveAsync(
        string organizationId, Guid dataSourceId, string userId, QueryRequest? request,
        CancellationToken cancellationToken)
    {
        // Membership must precede source and schema lookups to prevent enumeration.
        if (await organizations.GetRoleAsync(organizationId, userId, cancellationToken) is null)
            throw new ForbiddenException();

        var source = await dataSources.FindAsync(organizationId, dataSourceId, cancellationToken);
        if (source is null) return null;

        if (request is null || !QueryShapeValidator.IsIdentifier(request.Dataset))
            throw new InvalidQueryException("Invalid query shape.");

        var dataset = await datasets.FindAsync(organizationId, dataSourceId, request.Dataset,
            cancellationToken);
        return (source.Provider, dataset);
    }
}
