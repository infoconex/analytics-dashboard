using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Infrastructure;

/// <summary>Restricted SQLite dialect; never opens a database connection.</summary>
public sealed class SqliteQueryCompiler() : RelationalQueryCompiler(DataSourceProvider.Sqlite)
{
    private protected override string Quote(string identifier) => $"\"{identifier}\"";

    // instr handles %, _, [ and ] literally, unlike a LIKE pattern.
    private protected override string TextSearch(string field, string parameter, bool prefix) =>
        $"instr({field}, {parameter}) {(prefix ? "= 1" : "> 0")}";

    private protected override string Page(int limit, int offset) => $"LIMIT {limit} OFFSET {offset}";
}
