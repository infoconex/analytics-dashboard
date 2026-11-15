using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Infrastructure;

/// <summary>PostgreSQL dialect compiler; never opens a database connection.</summary>
public sealed class PostgreSqlQueryCompiler() : RelationalQueryCompiler(DataSourceProvider.PostgreSql)
{
    protected override string Quote(string identifier) => $"\"{identifier}\"";

    protected override string TextSearch(string field, string parameter, bool prefix) =>
        $"strpos({field}, {parameter}) {(prefix ? "= 1" : "> 0")}";

    protected override string Page(int limit, int offset) => $"LIMIT {limit} OFFSET {offset}";
}
