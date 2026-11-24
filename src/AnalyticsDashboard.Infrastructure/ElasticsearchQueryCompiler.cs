using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Infrastructure;

/// <summary>
/// Compiles only trusted, structured Elasticsearch Query DSL from validated
/// provider-neutral requests. No connection, client, raw DSL, script or endpoint.
/// </summary>
public sealed class ElasticsearchQueryCompiler
{
    private static readonly Regex IndexPattern = new("^[a-z][a-z0-9_-]{0,127}$",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);
    private static readonly Regex PathPattern = new(
        "^[A-Za-z_][A-Za-z0-9_]*(\\.[A-Za-z_][A-Za-z0-9_]*)*$",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);

    public CompiledElasticsearchQuery Compile(ElasticsearchDatasetBinding? binding, QueryRequest? request)
    {
        if (binding?.Dataset?.Fields is null || binding.Fields is null
            || !IndexPattern.IsMatch(binding.Index ?? "")
            || !binding.StableKeyIsUniqueAndPresent
            || !QueryShapeValidator.IsIdentifier(binding.StableSortField)
            || binding.Fields.Count != binding.Dataset.Fields.Count)
            throw Invalid();

        foreach (var logical in binding.Dataset.Fields)
        {
            if (logical is null || !binding.Fields.TryGetValue(logical.Name, out var field)
                || field is null || !PathPattern.IsMatch(field.QueryPath ?? "")
                || !PathPattern.IsMatch(field.SourcePath ?? "")
                || (logical.Type == QueryValueType.Text && !field.ExactKeyword)
                || (logical.Type != QueryValueType.Text && field.ExactKeyword))
                throw Invalid();
        }
        if (binding.Fields.Keys.Any(key => !binding.Dataset.Fields.Any(field => field.Name == key))
            || !binding.Dataset.Fields.Any(field => field.Name == binding.StableSortField
                && field.Sortable))
            throw Invalid();

        // Re-run validation at the compilation boundary. The public validation
        // API (which uses an empty production catalog) is not a capability token.
        var validated = QueryShapeValidator.Validate(DataSourceProvider.Elasticsearch, binding.Dataset, request);
        var req = request!;
        var projections = req.Projection ?? [];
        var groups = req.GroupBy ?? [];
        var metrics = req.Aggregates ?? [];
        var sorts = req.Sort ?? [];

        string Path(string logical) => binding.Fields[logical].QueryPath;

        var filterClauses = new List<object>();
        foreach (var filter in req.Filters ?? [])
        {
            var field = Path(filter.Field);
            var values = filter.Values ?? [];
            var clause = filter.Operator switch
            {
                QueryOperator.Equal => Obj("term", Obj(field, Obj("value", Scalar(values[0])))),
                QueryOperator.NotEqual => Obj("bool", new Dictionary<string, object>
                {
                    ["filter"] = new object[] { Obj("exists", Obj("field", field)) },
                    ["must_not"] = new object[] { Obj("term", Obj(field, Obj("value", Scalar(values[0])))) }
                }),
                QueryOperator.In => Obj("terms", Obj(field, values.Select(Scalar).ToArray())),
                QueryOperator.IsNull => Obj("bool", Obj("must_not",
                    new object[] { Obj("exists", Obj("field", field)) })),
                QueryOperator.IsNotNull => Obj("exists", Obj("field", field)),
                QueryOperator.GreaterThan => Range(field, "gt", values[0]),
                QueryOperator.GreaterThanOrEqual => Range(field, "gte", values[0]),
                QueryOperator.LessThan => Range(field, "lt", values[0]),
                QueryOperator.LessThanOrEqual => Range(field, "lte", values[0]),
                _ => throw Invalid()
            };
            filterClauses.Add(clause);
        }

        var root = new Dictionary<string, object>
        {
            ["track_total_hits"] = false,
            ["query"] = filterClauses.Count == 0
                ? Obj("match_all", new Dictionary<string, object>())
                : Obj("bool", Obj("filter", filterClauses))
        };

        if (groups.Count != 0)
        {
            if (validated.Offset != 0
                || (sorts.Count != 0 && (sorts.Count != groups.Count
                    || !sorts.Select(x => x.Field).SequenceEqual(groups))))
                throw new InvalidQueryException("Unsupported Elasticsearch group paging or sort.");

            var sources = new List<object>();
            for (var i = 0; i < groups.Count; i++)
            {
                var order = sorts.Count == 0 || sorts[i].Direction == QuerySortDirection.Ascending
                    ? "asc" : "desc";
                sources.Add(Obj(groups[i], Obj("terms", new Dictionary<string, object>
                {
                    ["field"] = Path(groups[i]),
                    ["order"] = order,
                    ["missing_bucket"] = true
                })));
            }
            var composite = new Dictionary<string, object>
            {
                ["composite"] = new Dictionary<string, object>
                {
                    ["size"] = validated.Limit,
                    ["sources"] = sources
                }
            };
            if (metrics.Count != 0) composite["aggs"] = Metrics(metrics, Path, binding.StableSortField);
            root["size"] = 0;
            root["aggs"] = Obj("groups", composite);
        }
        else if (metrics.Count != 0)
        {
            if (validated.Offset != 0)
                throw new InvalidQueryException("Aggregate-only Elasticsearch queries cannot be offset.");
            root["size"] = 0;
            root["aggs"] = Metrics(metrics, Path, binding.StableSortField);
        }
        else
        {
            root["size"] = validated.Limit;
            root["from"] = validated.Offset;
            root["_source"] = Obj("includes", projections.Select(
                name => binding.Fields[name].SourcePath).ToArray());

            var order = new List<object>();
            foreach (var sort in sorts)
                order.Add(Obj(Path(sort.Field), Obj("order",
                    sort.Direction == QuerySortDirection.Descending ? "desc" : "asc")));
            if (!sorts.Any(x => x.Field == binding.StableSortField))
                order.Add(Obj(Path(binding.StableSortField), Obj("order", "asc")));
            root["sort"] = order;
        }

        return new CompiledElasticsearchQuery(binding.Index,
            JsonSerializer.Serialize(root), validated.Columns.ToArray(),
            validated.Limit, validated.Offset);
    }

    private static Dictionary<string, object> Metrics(IReadOnlyList<QueryAggregate> aggregates,
        Func<string, string> path, string stableKey)
    {
        var result = new Dictionary<string, object>(StringComparer.Ordinal);
        foreach (var aggregate in aggregates)
        {
            var operation = aggregate.Function switch
            {
                QueryAggregateFunction.Count => "value_count",
                QueryAggregateFunction.Sum => "sum",
                QueryAggregateFunction.Average => "avg",
                QueryAggregateFunction.Minimum => "min",
                QueryAggregateFunction.Maximum => "max",
                _ => throw Invalid()
            };
            // COUNT(*) uses the operator-declared non-null unique stable key.
            var field = aggregate.Function == QueryAggregateFunction.Count
                ? path(stableKey) : path(aggregate.Field!);
            result.Add(aggregate.Alias, Obj(operation, Obj("field", field)));
        }
        return result;
    }

    private static Dictionary<string, object> Range(string field, string op, QueryScalar value) =>
        Obj("range", Obj(field, Obj(op, Scalar(value))));

    private static object Scalar(QueryScalar value) => value.Type switch
    {
        QueryValueType.Text => value.Text!,
        QueryValueType.Number => value.Number!.Value,
        QueryValueType.Boolean => value.Boolean!.Value,
        QueryValueType.Timestamp => value.Timestamp!.Value.ToUniversalTime()
            .ToString("yyyy-MM-ddTHH:mm:ss.fffffff'Z'", CultureInfo.InvariantCulture),
        _ => throw Invalid()
    };

    private static Dictionary<string, object> Obj(string key, object value) =>
        new(StringComparer.Ordinal) { [key] = value };

    private static InvalidQueryException Invalid() =>
        new("Restricted Elasticsearch query is not permitted.");
}
