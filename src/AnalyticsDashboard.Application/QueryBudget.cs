namespace AnalyticsDashboard.Application;

/// <summary>Hard validation limits and *future* execution budgets; execution is not available.</summary>
public sealed record QueryBudget(
    int DefaultRows = 100,
    int MaximumRows = 500,
    int MaximumOffset = 5000,
    int MaximumProjectedFields = 16,
    int MaximumFilters = 12,
    int MaximumInValues = 10,
    int MaximumGroupFields = 6,
    int MaximumAggregates = 6,
    int MaximumSortFields = 4,
    int MaximumComplexity = 100,
    int TimeoutMilliseconds = 10000,
    int MaximumResultBytes = 1048576,
    int MaximumConcurrentQueries = 2);
