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
        // Membership must precede source and schema lookups to prevent enumeration.
        if (await organizations.GetRoleAsync(organizationId, userId, cancellationToken) is null)
            throw new ForbiddenException();

        var source = await dataSources.FindAsync(organizationId, dataSourceId, cancellationToken);
        if (source is null) return null;

        if (request is null || !QueryShapeValidator.IsIdentifier(request.Dataset))
            throw new InvalidQueryException("Invalid query shape.");

        var dataset = await datasets.FindAsync(organizationId, dataSourceId, request.Dataset,
            cancellationToken);
        return QueryShapeValidator.Validate(source.Provider, dataset, request);
    }
}
