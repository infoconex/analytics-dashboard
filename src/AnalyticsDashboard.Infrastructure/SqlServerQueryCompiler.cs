using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Infrastructure;

/// <summary>SQL Server dialect compiler; never opens a database connection.</summary>
public sealed class SqlServerQueryCompiler() : RelationalQueryCompiler(DataSourceProvider.SqlServer)
{
    protected override string Quote(string identifier) => $"[{identifier}]";

    protected override string TextSearch(string field, string parameter, bool prefix) =>
        $"CHARINDEX({parameter}, {field}) {(prefix ? "= 1" : "> 0")}";

    protected override string Page(int limit, int offset) =>
        $"OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY";
}
