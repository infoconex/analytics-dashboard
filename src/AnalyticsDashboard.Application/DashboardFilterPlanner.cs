using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

/// <summary>Pure offline planning over trusted, already-authorized dataset metadata.
/// Production callers must resolve metadata through the tenant-scoped service.
/// No customer execution, joins, or physical identifier input from shared filters.</summary>
public static class DashboardFilterPlanner
{
    public const string ReportingTime = "reporting_time";
    private static readonly QueryBudget Limits = new();

    public static DashboardFilterPlan Plan(DataSourceProvider provider, QueryDataset? dataset,
        QueryRequest? request, SharedDashboardFilters? context)
    {
        // Do not allow shared predicates to repair or replace an invalid base query.
        QueryShapeValidator.Validate(provider, dataset, request);
        if (context is null) throw Invalid("Invalid shared filter context.");

        var fields = context.Fields ?? [];
        if (fields.Count > Limits.MaximumFilters - (context.DateRange is null ? 0 : 2))
            throw Invalid("Shared filters exceed a resource limit.");

        // Validate selections before considering applicability, including when none map.
        DateTimeOffset? start = null, end = null;
        if (context.DateRange is { } range)
        {
            if (range.Start is not { } from || range.End is not { } until || from >= until)
                throw Invalid("Reporting time requires a non-empty ordered interval.");
            start = from.ToUniversalTime();
            end = until.ToUniversalTime();
        }

        foreach (var filter in fields)
        {
            if (filter is null || !QueryShapeValidator.IsIdentifier(filter.Dimension)
                || filter.Dimension == ReportingTime || !Enum.IsDefined(filter.Type))
                throw Invalid("Invalid shared filter dimension or type.");
            // Reuse exact scalar, comparison, cardinality and text limits. Provider
            // capability is evaluated separately for each authorized target.
            QueryShapeValidator.ValidateFilter(new QueryField(filter.Dimension, filter.Type),
                new QueryFilter(filter.Dimension, filter.Operator, filter.Values));
        }

        // Metadata is operator-owned; reject ambiguous or malformed mappings rather
        // than guessing. A field without a mapping never participates automatically.
        var mappings = new Dictionary<string, QueryField>(StringComparer.Ordinal);
        foreach (var field in dataset!.Fields)
        {
            if (field.BusinessDimension is not { } dimension) continue;
            if (!QueryShapeValidator.IsIdentifier(dimension) || !mappings.TryAdd(dimension, field))
                throw Invalid("Invalid or ambiguous approved business-dimension metadata.");
        }

        var baseRequest = request!;
        var predicates = new List<QueryFilter>(baseRequest.Filters ?? []);
        var outcomes = new List<SharedFilterOutcome>();
        var capabilities = QueryProviderCapabilities.For(provider);
        FilterApplicability Resolve(string dimension, QueryValueType type, QueryOperator operation,
            out QueryField? field)
        {
            if (!mappings.TryGetValue(dimension, out field)) return FilterApplicability.NoApprovedMapping;
            if (!field.Filterable) return FilterApplicability.FieldNotFilterable;
            if (field.Type != type) return FilterApplicability.IncompatibleType;
            if (!capabilities.Operators.Contains(operation)) return FilterApplicability.UnsupportedOperator;
            return FilterApplicability.Applied;
        }

        if (start.HasValue)
        {
            var applicability = Resolve(ReportingTime, QueryValueType.Timestamp,
                QueryOperator.GreaterThanOrEqual, out var field);
            if (applicability == FilterApplicability.Applied
                && !capabilities.Operators.Contains(QueryOperator.LessThan))
                applicability = FilterApplicability.UnsupportedOperator;
            if (applicability == FilterApplicability.Applied)
            {
                predicates.Add(new QueryFilter(field!.Name, QueryOperator.GreaterThanOrEqual,
                    [new QueryScalar(QueryValueType.Timestamp, Timestamp: start)]));
                predicates.Add(new QueryFilter(field!.Name, QueryOperator.LessThan,
                    [new QueryScalar(QueryValueType.Timestamp, Timestamp: end)]));
            }
            outcomes.Add(new SharedFilterOutcome(ReportingTime, null, applicability));
        }

        for (var i = 0; i < fields.Count; i++)
        {
            var filter = fields[i];
            var applicability = Resolve(filter.Dimension, filter.Type, filter.Operator, out var field);
            if (applicability == FilterApplicability.Applied)
                predicates.Add(new QueryFilter(field!.Name, filter.Operator, filter.Values?.ToArray()));
            outcomes.Add(new SharedFilterOutcome(filter.Dimension, i, applicability));
        }

        var result = baseRequest with { Filters = predicates.AsReadOnly() };
        // Combined budget and all base predicates remain mandatory. A failure must
        // surface as a failed plan, never an unfiltered fallback.
        QueryShapeValidator.Validate(provider, dataset, result);
        return new DashboardFilterPlan(result, outcomes.AsReadOnly());
    }

    private static InvalidQueryException Invalid(string message) => new(message);
}
