using System.Data;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using MySqlConnector;

namespace AnalyticsDashboard.Infrastructure;

/// <summary>Binds an inert compiled plan to a supplied MySQL connection; never connects.</summary>
public static class MySqlCommandFactory
{
    public static MySqlCommand Create(MySqlConnection connection, CompiledRelationalQuery query)
    {
        ArgumentNullException.ThrowIfNull(connection);
        ArgumentNullException.ThrowIfNull(query);
        if (query.Provider != DataSourceProvider.MySql)
            throw new InvalidQueryException("Wrong relational query provider.");

        var command = connection.CreateCommand();
        command.CommandType = CommandType.Text;
        command.CommandTimeout = new QueryBudget().TimeoutMilliseconds / 1000;
        foreach (var parameter in query.Parameters)
        {
            MySqlDbType type;
            object value;
            switch (parameter.Type)
            {
                case QueryValueType.Text:
                    type = MySqlDbType.VarChar;
                    value = parameter.Value;
                    break;
                case QueryValueType.Number:
                    type = MySqlDbType.Decimal;
                    value = parameter.Value;
                    break;
                case QueryValueType.Boolean:
                    type = MySqlDbType.Int16;
                    value = (bool)parameter.Value ? (short)1 : (short)0;
                    break;
                case QueryValueType.Timestamp:
                    // Trusted MySQL datasets store UTC instants in DATETIME(6).
                    // A value with sub-microsecond precision cannot be represented
                    // without changing an exact half-open time boundary.
                    var utc = ((DateTimeOffset)parameter.Value).UtcDateTime;
                    if (utc.Ticks % 10 != 0)
                        throw new InvalidQueryException("MySQL timestamp precision exceeds six decimals.");
                    type = MySqlDbType.DateTime;
                    value = utc;
                    break;
                default:
                    throw new InvalidQueryException("Invalid query parameter type.");
            }

            command.Parameters.Add(new MySqlParameter(parameter.Name, type) { Value = value });
        }
        command.CommandText = query.CommandText;
        return command;
    }
}
