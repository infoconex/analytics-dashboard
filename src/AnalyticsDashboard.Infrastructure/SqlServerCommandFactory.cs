using System.Data;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using Microsoft.Data.SqlClient;

namespace AnalyticsDashboard.Infrastructure;

/// <summary>Binds a compiled SELECT to a supplied native connection; never opens a socket.</summary>
public static class SqlServerCommandFactory
{
    public static SqlCommand Create(SqlConnection connection, CompiledRelationalQuery query)
    {
        ArgumentNullException.ThrowIfNull(connection);
        ArgumentNullException.ThrowIfNull(query);
        if (query.Provider != DataSourceProvider.SqlServer)
            throw new InvalidQueryException("Wrong relational query provider.");

        var command = connection.CreateCommand();
        command.CommandType = CommandType.Text;
        command.CommandTimeout = new QueryBudget().TimeoutMilliseconds / 1000;
        foreach (var parameter in query.Parameters)
        {
            var type = parameter.Type switch
            {
                QueryValueType.Text => SqlDbType.NVarChar,
                QueryValueType.Number => SqlDbType.Decimal,
                QueryValueType.Boolean => SqlDbType.Bit,
                QueryValueType.Timestamp => SqlDbType.DateTimeOffset,
                _ => throw new InvalidQueryException("Invalid query parameter type.")
            };
            var native = new SqlParameter(parameter.Name, type) { Value = parameter.Value };
            if (type == SqlDbType.NVarChar) native.Size = 512;
            command.Parameters.Add(native);
        }
        command.CommandText = query.CommandText;
        return command;
    }
}
