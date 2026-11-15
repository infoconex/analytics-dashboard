using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Infrastructure;

/// <summary>
/// Compiles a restricted query against a trusted physical binding. No API or connection
/// uses this component until the remaining production security gates are implemented.
/// </summary>
public abstract class RelationalQueryCompiler
{
    private readonly DataSourceProvider provider;

    // External assemblies cannot derive a dialect that injects arbitrary SQL into
    // an otherwise unforgeable CompiledRelationalQuery.
    private protected RelationalQueryCompiler(DataSourceProvider provider) => this.provider = provider;

    public CompiledRelationalQuery Compile(RelationalDatasetBinding? binding, QueryRequest? request)
    {
        if (binding?.Dataset is null || !QueryShapeValidator.IsIdentifier(binding.Schema)
            || !QueryShapeValidator.IsIdentifier(binding.Table)
            || !QueryShapeValidator.IsIdentifier(binding.StableOrderField))
            throw Invalid();

        // A physical table name is never supplied by request JSON. Require the stable key
        // to be a trusted, sortable column before any compilation, even for aggregates.
        if (binding.Dataset.Fields is null || !binding.Dataset.Fields.Any(field =>
            field is not null && field.Name == binding.StableOrderField && field.Sortable))
            throw Invalid();

        // Revalidate the actual request and trusted schema at the compilation boundary:
        // /queries/validate is advisory, not a capability token.
        var result = QueryShapeValidator.Validate(provider, binding.Dataset, request);
        var projection = request!.Projection ?? [];
        var aggregates = request.Aggregates ?? [];
        var grouping = request.GroupBy ?? [];
        var sorting = request.Sort ?? [];

        if (grouping.Any(name => !binding.Dataset.Fields.Single(field => field.Name == name).Sortable))
            throw Invalid();

        var parameters = new List<CompiledQueryParameter>();
        string Bind(QueryScalar value)
        {
            var name = $"@p{parameters.Count}";
            object typedValue = value.Type switch
            {
                QueryValueType.Text => value.Text!,
                QueryValueType.Number => value.Number!.Value,
                QueryValueType.Boolean => value.Boolean!.Value,
                QueryValueType.Timestamp => value.Timestamp!.Value.ToUniversalTime(),
                _ => throw Invalid()
            };
            parameters.Add(new CompiledQueryParameter(name, value.Type, typedValue));
            return name;
        }

        var selection = new List<string>(projection.Select(Quote));
        foreach (var aggregate in aggregates)
        {
            var function = aggregate.Function switch
            {
                QueryAggregateFunction.Count => "COUNT",
                QueryAggregateFunction.Sum => "SUM",
                QueryAggregateFunction.Average => "AVG",
                QueryAggregateFunction.Minimum => "MIN",
                QueryAggregateFunction.Maximum => "MAX",
                _ => throw Invalid()
            };
            var input = aggregate.Function == QueryAggregateFunction.Count ? "*" : Quote(aggregate.Field!);
            selection.Add($"{function}({input}) AS {Quote(aggregate.Alias)}");
        }

        var sql = $"SELECT {string.Join(", ", selection)} FROM {Quote(binding.Schema)}.{Quote(binding.Table)}";
        var filters = request.Filters ?? [];
        if (filters.Count != 0)
        {
            var conditions = new List<string>();
            foreach (var filter in filters)
            {
                var field = Quote(filter.Field);
                var values = filter.Values ?? [];
                string condition = filter.Operator switch
                {
                    QueryOperator.IsNull => $"{field} IS NULL",
                    QueryOperator.IsNotNull => $"{field} IS NOT NULL",
                    QueryOperator.In => $"{field} IN ({string.Join(", ", values.Select(Bind))})",
                    QueryOperator.Contains => TextSearch(field, Bind(values[0]), false),
                    QueryOperator.StartsWith => TextSearch(field, Bind(values[0]), true),
                    _ => $"{field} {Comparison(filter.Operator)} {Bind(values[0])}"
                };
                conditions.Add(condition);
            }
            sql += " WHERE " + string.Join(" AND ", conditions);
        }

        if (grouping.Count != 0)
            sql += " GROUP BY " + string.Join(", ", grouping.Select(Quote));

        if (grouping.Count == 0 && aggregates.Count != 0)
        {
            // Exactly one aggregate row; OFFSET would hide it and cannot be used with
            // SQL Server's OFFSET/FETCH without a meaningful ORDER BY.
            if (result.Offset != 0) throw Invalid();
        }
        else
        {
            var order = sorting.Select(sort => $"{Quote(sort.Field)} " +
                (sort.Direction == QuerySortDirection.Descending ? "DESC" : "ASC")).ToList();
            var sorted = sorting.Select(sort => sort.Field).ToHashSet(StringComparer.Ordinal);
            // Every group is uniquely identified by all grouping keys. For ungrouped
            // records, the operator-declared stable unique key resolves pagination ties.
            IReadOnlyList<string> tieBreakers = grouping.Count != 0 ? grouping : [binding.StableOrderField];
            foreach (var field in tieBreakers)
                if (sorted.Add(field)) order.Add($"{Quote(field)} ASC");

            sql += " ORDER BY " + string.Join(", ", order) + " " + Page(result.Limit, result.Offset);
        }

        return new CompiledRelationalQuery(provider, sql, parameters.AsReadOnly(),
            result.Columns.ToArray(), result.Limit, result.Offset);
    }

    private protected abstract string Quote(string identifier);
    private protected abstract string TextSearch(string field, string parameter, bool prefix);
    private protected abstract string Page(int limit, int offset);

    private static string Comparison(QueryOperator op) => op switch
    {
        QueryOperator.Equal => "=",
        QueryOperator.NotEqual => "<>",
        QueryOperator.GreaterThan => ">",
        QueryOperator.GreaterThanOrEqual => ">=",
        QueryOperator.LessThan => "<",
        QueryOperator.LessThanOrEqual => "<=",
        _ => throw Invalid()
    };

    private static InvalidQueryException Invalid() => new("Restricted relational query is not permitted.");
}
