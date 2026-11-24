using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Infrastructure;

/// <summary>Restricted MySQL dialect compiler; builds inert plans only.</summary>
public sealed class MySqlQueryCompiler() : RelationalQueryCompiler(DataSourceProvider.MySql)
{
    private protected override string Quote(string identifier) => $"{(char)96}{identifier}{(char)96}";

    // INSTR accepts literal parameters; it never treats SQL LIKE wildcard
    // characters in user data as operators.
    private protected override string TextSearch(string field, string parameter, bool prefix) =>
        $"INSTR({field}, {parameter}) {(prefix ? "= 1" : "> 0")}";

    private protected override string Page(int limit, int offset) => $"LIMIT {limit} OFFSET {offset}";
}
