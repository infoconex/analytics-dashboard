using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

/// <summary>Authorizes and validates query shapes; has no query execution dependency.</summary>
public sealed class QueryService(
    IDataSourceRepository dataSources,
    IOrganizationCatalog organizations,
    IQueryDatasetCatalog datasets)
{
    private static readonly QueryBudget Limits = new();

    public async Task<QueryValidationResult?> ValidateAsync(
        string organizationId, Guid dataSourceId, string userId, QueryRequest? request,
        CancellationToken cancellationToken)
    {
        // Keep the membership check ahead of all source/schema lookups to prevent enumeration.
        if (await organizations.GetRoleAsync(organizationId, userId, cancellationToken) is null)
            throw new ForbiddenException();

        var source = await dataSources.FindAsync(organizationId, dataSourceId, cancellationToken);
        if (source is null) return null;

        if (request is null || !IsIdentifier(request.Dataset))
            throw Invalid("Invalid query shape.");

        var projection = request.Projection ?? [];
        var filters = request.Filters ?? [];
        var grouping = request.GroupBy ?? [];
        var aggregates = request.Aggregates ?? [];
        var sorting = request.Sort ?? [];

        if (projection.Count > Limits.MaximumProjectedFields || filters.Count > Limits.MaximumFilters
            || grouping.Count > Limits.MaximumGroupFields || aggregates.Count > Limits.MaximumAggregates
            || sorting.Count > Limits.MaximumSortFields)
            throw Invalid("Query shape exceeds a resource limit.");

        var limit = request.Limit ?? Limits.DefaultRows;
        var offset = request.Offset ?? 0;
        if (limit < 1 || limit > Limits.MaximumRows || offset < 0 || offset > Limits.MaximumOffset)
            throw Invalid("Pagination exceeds a resource limit.");

        var dataset = await datasets.FindAsync(organizationId, dataSourceId, request.Dataset,
            cancellationToken);
        if (dataset is null || !string.Equals(dataset.Name, request.Dataset, StringComparison.Ordinal)
            || dataset.Fields is null || dataset.Fields.Count == 0
            || dataset.Fields.Any(field => field is null || !IsIdentifier(field.Name))
            || HasDuplicates(dataset.Fields.Select(field => field.Name)))
            throw Invalid("Dataset is not available for this data source.");

        var fields = dataset.Fields.ToDictionary(field => field.Name, StringComparer.Ordinal);
        var capabilities = QueryProviderCapabilities.For(source.Provider);
        if (HasDuplicates(projection) || HasDuplicates(grouping) ||
            projection.Any(name => !IsIdentifier(name) || !fields.ContainsKey(name)) ||
            grouping.Any(name => !IsIdentifier(name) || !fields.TryGetValue(name, out var field)
                || !field.Groupable))
            throw Invalid("Projection or grouping contains a disallowed field.");

        if (grouping.Count > 0 && (projection.Count != grouping.Count ||
            projection.Except(grouping, StringComparer.Ordinal).Any()))
            throw Invalid("Grouped projection must contain exactly the group fields.");

        if (aggregates.Count > 0 && grouping.Count == 0 && projection.Count > 0)
            throw Invalid("Ungrouped aggregates cannot mix with raw projections.");

        if (projection.Count == 0 && grouping.Count == 0 && aggregates.Count == 0)
            throw Invalid("A projection or an aggregate is required.");

        var columns = new List<QueryColumn>();
        foreach (var name in projection)
            columns.Add(new QueryColumn(name, fields[name].Type));

        foreach (var aggregate in aggregates)
        {
            if (aggregate is null || !IsIdentifier(aggregate.Alias)
                || fields.ContainsKey(aggregate.Alias)
                || columns.Any(column => column.Name == aggregate.Alias)
                || !Enum.IsDefined(aggregate.Function)
                || !capabilities.Aggregates.Contains(aggregate.Function))
                throw Invalid("Unsupported aggregation or duplicate result name.");

            QueryValueType outputType;
            if (aggregate.Function == QueryAggregateFunction.Count)
            {
                if (aggregate.Field is not null) throw Invalid("Count does not take a field.");
                outputType = QueryValueType.Number;
            }
            else
            {
                if (aggregate.Field is null || !fields.TryGetValue(aggregate.Field, out var field)
                    || !field.Aggregatable)
                    throw Invalid("Aggregation field is not permitted.");

                if (aggregate.Function is QueryAggregateFunction.Sum or QueryAggregateFunction.Average)
                {
                    if (field.Type != QueryValueType.Number)
                        throw Invalid("Aggregation is not supported for this field type.");
                    outputType = QueryValueType.Number;
                }
                else
                {
                    if (field.Type == QueryValueType.Boolean)
                        throw Invalid("Aggregation is not supported for this field type.");
                    outputType = field.Type;
                }
            }
            columns.Add(new QueryColumn(aggregate.Alias, outputType));
        }

        var complexity = projection.Count + grouping.Count * 4 + aggregates.Count * 4 + sorting.Count;
        foreach (var filter in filters)
        {
            if (filter is null || !IsIdentifier(filter.Field)
                || !fields.TryGetValue(filter.Field, out var field)
                || !field.Filterable || !Enum.IsDefined(filter.Operator)
                || !capabilities.Operators.Contains(filter.Operator))
                throw Invalid("Filter field or operator is not permitted.");

            var values = filter.Values ?? [];
            var expected = filter.Operator switch
            {
                QueryOperator.IsNull or QueryOperator.IsNotNull => 0,
                QueryOperator.In => -1,
                _ => 1
            };
            if (values.Count > Limits.MaximumInValues ||
                (expected >= 0 && values.Count != expected) ||
                (expected == -1 && (values.Count == 0 || values.Count > Limits.MaximumInValues)))
                throw Invalid("Invalid filter value count.");

            if ((filter.Operator is QueryOperator.GreaterThan or QueryOperator.GreaterThanOrEqual
                or QueryOperator.LessThan or QueryOperator.LessThanOrEqual) &&
                field.Type is not (QueryValueType.Number or QueryValueType.Timestamp))
                throw Invalid("Comparison is not supported for this field type.");

            if ((filter.Operator is QueryOperator.Contains or QueryOperator.StartsWith)
                && field.Type != QueryValueType.Text)
                throw Invalid("Text matching requires a text field.");

            foreach (var value in values)
                if (!IsValidScalar(value, field.Type))
                    throw Invalid("Filter value type does not match the field.");

            complexity += 2 + values.Count;
        }

        if (HasDuplicates(sorting.Select(sort => sort?.Field)))
            throw Invalid("Sort fields must be unique.");

        foreach (var sort in sorting)
        {
            if (sort is null || !Enum.IsDefined(sort.Direction)
                || !columns.Any(column => column.Name == sort.Field))
                throw Invalid("Sort field must occur in the result schema.");

            // Aggregate aliases are result fields. Raw fields must also have sort permission.
            if (projection.Contains(sort.Field, StringComparer.Ordinal)
                && !fields[sort.Field].Sortable)
                throw Invalid("Sorting is not permitted for this field.");
        }

        if (complexity > Limits.MaximumComplexity)
            throw Invalid("Query complexity exceeds a resource limit.");

        return new QueryValidationResult(dataset.Name, source.Provider, columns, limit, offset,
            complexity, Limits);
    }

    private static bool IsValidScalar(QueryScalar? value, QueryValueType fieldType)
    {
        if (value is null || !Enum.IsDefined(value.Type) || value.Type != fieldType)
            return false;

        var supplied = (value.Text is not null ? 1 : 0) + (value.Number is not null ? 1 : 0)
            + (value.Boolean is not null ? 1 : 0) + (value.Timestamp is not null ? 1 : 0);
        if (supplied != 1) return false;

        return value.Type switch
        {
            QueryValueType.Text => value.Text is { Length: <= 512 } text
                && !text.Any(char.IsControl),
            QueryValueType.Number => value.Number.HasValue,
            QueryValueType.Boolean => value.Boolean.HasValue,
            QueryValueType.Timestamp => value.Timestamp.HasValue,
            _ => false
        };
    }

    private static bool HasDuplicates(IEnumerable<string?> values)
    {
        var seen = new HashSet<string?>(StringComparer.Ordinal);
        return values.Any(value => value is null || !seen.Add(value));
    }

    private static bool IsIdentifier(string? name)
    {
        if (string.IsNullOrEmpty(name) || name.Length > 128
            || !(char.IsAsciiLetter(name[0]) || name[0] == '_')) return false;
        return name.Skip(1).All(character => char.IsAsciiLetterOrDigit(character) || character == '_');
    }

    private static InvalidQueryException Invalid(string reason) => new(reason);
}
