using System.Data;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using Npgsql;
using NpgsqlTypes;

namespace AnalyticsDashboard.Infrastructure;

/// <summary>Binds a compiled SELECT to a supplied native connection; never opens a socket.</summary>
public static class PostgreSqlCommandFactory
{
    public static NpgsqlCommand Create(NpgsqlConnection connection, CompiledRelationalQuery query)
    {
        ArgumentNullException.ThrowIfNull(connection);
        ArgumentNullException.ThrowIfNull(query);
        if (query.Provider != DataSourceProvider.PostgreSql)
            throw new InvalidQueryException("Wrong relational query provider.");

        var command = connection.CreateCommand();
        command.CommandType = CommandType.Text;
        command.CommandTimeout = new QueryBudget().TimeoutMilliseconds / 1000;
        foreach (var parameter in query.Parameters)
        {
            var type = parameter.Type switch
            {
                QueryValueType.Text => NpgsqlDbType.Text,
                QueryValueType.Number => NpgsqlDbType.Numeric,
                QueryValueType.Boolean => NpgsqlDbType.Boolean,
                QueryValueType.Timestamp => NpgsqlDbType.TimestampTz,
                _ => throw new InvalidQueryException("Invalid query parameter type.")
            };
            command.Parameters.Add(new NpgsqlParameter(parameter.Name, type) { Value = parameter.Value });
        }
        command.CommandText = query.CommandText;
        return command;
    }
}
