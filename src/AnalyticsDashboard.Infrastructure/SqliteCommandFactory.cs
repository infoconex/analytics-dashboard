using System.Data;
using System.Globalization;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using Microsoft.Data.Sqlite;

namespace AnalyticsDashboard.Infrastructure;

/// <summary>Binds trusted, inert SQLite SELECT plans; no connection is opened.</summary>
public static class SqliteCommandFactory
{
    // Trusted SQLite datasets must store UTC dates as canonical fixed-width TEXT.
    public const string UtcTimestampFormat = "yyyy-MM-ddTHH:mm:ss.fffffff'Z'";

    public static SqliteCommand Create(SqliteConnection connection, CompiledRelationalQuery query)
    {
        ArgumentNullException.ThrowIfNull(connection);
        ArgumentNullException.ThrowIfNull(query);
        if (query.Provider != DataSourceProvider.Sqlite)
            throw new InvalidQueryException("Wrong relational query provider.");

        var command = connection.CreateCommand();
        command.CommandType = CommandType.Text;
        command.CommandTimeout = new QueryBudget().TimeoutMilliseconds / 1000;
        foreach (var parameter in query.Parameters)
        {
            var (type, value) = parameter.Type switch
            {
                QueryValueType.Text => (SqliteType.Text, parameter.Value),
                QueryValueType.Number => (SqliteType.Text,
                    (object)((decimal)parameter.Value).ToString(CultureInfo.InvariantCulture)),
                QueryValueType.Boolean => (SqliteType.Integer,
                    (object)((bool)parameter.Value ? 1L : 0L)),
                QueryValueType.Timestamp => (SqliteType.Text,
                    (object)((DateTimeOffset)parameter.Value).UtcDateTime.ToString(
                        UtcTimestampFormat, CultureInfo.InvariantCulture)),
                _ => throw new InvalidQueryException("Invalid query parameter type.")
            };
            command.Parameters.Add(new SqliteParameter(parameter.Name, type) { Value = value });
        }
        command.CommandText = query.CommandText;
        return command;
    }
}
