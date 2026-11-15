using System.Globalization;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using Microsoft.Data.Sqlite;

namespace AnalyticsDashboard.Infrastructure;

// Each successful mutation and its redacted security event share one SQLite transaction.
public sealed class SqliteConnectionRepository(string databasePath) : IConnectionRepository
{
    private readonly string connectionString = new SqliteConnectionStringBuilder
    {
        DataSource = Path.GetFullPath(databasePath),
        Mode = SqliteOpenMode.ReadWriteCreate,
        ForeignKeys = true,
        Pooling = true
    }.ToString();

    public async Task InitializeAsync(CancellationToken token = default)
    {
        await using var connection = await OpenAsync(token);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS connection_profiles (
                organization_id TEXT NOT NULL,
                data_source_id TEXT NOT NULL,
                provider INTEGER NOT NULL,
                host TEXT,
                port INTEGER,
                database_name TEXT,
                username TEXT,
                sqlite_file_id TEXT,
                secret_key_id TEXT,
                secret_nonce TEXT,
                secret_ciphertext TEXT,
                secret_tag TEXT,
                revision INTEGER NOT NULL CHECK (revision > 0),
                configured_at TEXT NOT NULL,
                PRIMARY KEY (organization_id, data_source_id),
                FOREIGN KEY (organization_id, data_source_id)
                    REFERENCES data_source_definitions(organization_id, id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS connection_security_events (
                event_id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                data_source_id TEXT NOT NULL,
                actor_id TEXT NOT NULL,
                action TEXT NOT NULL,
                outcome TEXT NOT NULL CHECK (outcome = 'succeeded'),
                occurred_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS connection_events_tenant_time
                ON connection_security_events(organization_id, occurred_at DESC);
            """;
        await command.ExecuteNonQueryAsync(token);
    }

    public async Task<ConnectionProfile?> FindAsync(string organizationId, Guid dataSourceId,
        CancellationToken token)
    {
        await using var connection = await OpenAsync(token);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT organization_id, data_source_id, provider, host, port, database_name,
                   username, sqlite_file_id, secret_key_id, secret_nonce, secret_ciphertext,
                   secret_tag, revision, configured_at
            FROM connection_profiles WHERE organization_id = $org AND data_source_id = $id
            """;
        command.Parameters.AddWithValue("$org", organizationId);
        command.Parameters.AddWithValue("$id", dataSourceId.ToString("D"));
        await using var reader = await command.ExecuteReaderAsync(token);
        if (!await reader.ReadAsync(token)) return null;
        var network = reader.IsDBNull(3) ? null : new NetworkConnectionDetails(
            reader.GetString(3), reader.GetInt32(4),
            reader.IsDBNull(5) ? null : reader.GetString(5),
            reader.IsDBNull(6) ? null : reader.GetString(6));
        var secret = reader.IsDBNull(8) ? null : new ProtectedConnectionSecret(
            reader.GetString(8), reader.GetString(9), reader.GetString(10), reader.GetString(11));
        return new ConnectionProfile(reader.GetString(0), Guid.Parse(reader.GetString(1)),
            (DataSourceProvider)reader.GetInt32(2), network,
            reader.IsDBNull(7) ? null : reader.GetString(7), secret, reader.GetInt32(12),
            DateTimeOffset.Parse(reader.GetString(13), CultureInfo.InvariantCulture));
    }

    public async Task<bool> SaveAsync(ConnectionProfile profile, int expectedRevision,
        string actor, string action, CancellationToken token)
    {
        await using var connection = await OpenAsync(token);
        await using var transaction = await connection.BeginTransactionAsync(token);
        await using var command = connection.CreateCommand();
        command.Transaction = (SqliteTransaction)transaction;
        if (expectedRevision == 0)
        {
            command.CommandText = """
                INSERT INTO connection_profiles
                    (organization_id, data_source_id, provider, host, port, database_name,
                     username, sqlite_file_id, secret_key_id, secret_nonce, secret_ciphertext,
                     secret_tag, revision, configured_at)
                SELECT $org, $id, $provider, $host, $port, $database, $username,
                       $file, $key, $nonce, $cipher, $tag, $revision, $at
                FROM data_source_definitions
                WHERE organization_id = $org AND id = $id AND provider = $provider
                """;
        }
        else
        {
            command.CommandText = """
                UPDATE connection_profiles
                SET host = $host, port = $port, database_name = $database,
                    username = $username, sqlite_file_id = $file, secret_key_id = $key,
                    secret_nonce = $nonce, secret_ciphertext = $cipher, secret_tag = $tag,
                    revision = $revision, configured_at = $at
                WHERE organization_id = $org AND data_source_id = $id
                    AND provider = $provider AND revision = $expected
                """;
        }
        AddParameters(command, profile);
        command.Parameters.AddWithValue("$expected", expectedRevision);
        int changed;
        try
        {
            changed = await command.ExecuteNonQueryAsync(token);
        }
        catch (SqliteException ex) when (ex.SqliteErrorCode == 19)
        {
            return false;
        }
        if (changed != 1) return false;
        await WriteEventAsync(connection, (SqliteTransaction)transaction,
            profile.OrganizationId, profile.DataSourceId, actor, action, profile.ConfiguredAt, token);
        await transaction.CommitAsync(token);
        return true;
    }

    public async Task<bool> DeleteAsync(string organizationId, Guid dataSourceId,
        int expectedRevision, string actor, CancellationToken token)
    {
        await using var connection = await OpenAsync(token);
        await using var transaction = await connection.BeginTransactionAsync(token);
        await using var command = connection.CreateCommand();
        command.Transaction = (SqliteTransaction)transaction;
        command.CommandText = """
            DELETE FROM connection_profiles WHERE organization_id = $org
                AND data_source_id = $id AND revision = $revision
            """;
        command.Parameters.AddWithValue("$org", organizationId);
        command.Parameters.AddWithValue("$id", dataSourceId.ToString("D"));
        command.Parameters.AddWithValue("$revision", expectedRevision);
        if (await command.ExecuteNonQueryAsync(token) != 1) return false;
        await WriteEventAsync(connection, (SqliteTransaction)transaction,
            organizationId, dataSourceId, actor, "revoked", DateTimeOffset.UtcNow, token);
        await transaction.CommitAsync(token);
        return true;
    }

    private static async Task WriteEventAsync(SqliteConnection connection,
        SqliteTransaction transaction, string organizationId, Guid dataSourceId, string actor,
        string action, DateTimeOffset at, CancellationToken token)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            INSERT INTO connection_security_events
                (event_id, organization_id, data_source_id, actor_id, action, outcome, occurred_at)
            VALUES ($event, $org, $id, $actor, $action, 'succeeded', $at)
            """;
        command.Parameters.AddWithValue("$event", Guid.NewGuid().ToString("D"));
        command.Parameters.AddWithValue("$org", organizationId);
        command.Parameters.AddWithValue("$id", dataSourceId.ToString("D"));
        command.Parameters.AddWithValue("$actor", actor);
        command.Parameters.AddWithValue("$action", action);
        command.Parameters.AddWithValue("$at", at.ToString("O"));
        await command.ExecuteNonQueryAsync(token);
    }

    private static void AddParameters(SqliteCommand command, ConnectionProfile profile)
    {
        command.Parameters.AddWithValue("$org", profile.OrganizationId);
        command.Parameters.AddWithValue("$id", profile.DataSourceId.ToString("D"));
        command.Parameters.AddWithValue("$provider", (int)profile.Provider);
        command.Parameters.AddWithValue("$host", (object?)profile.Network?.Host ?? DBNull.Value);
        command.Parameters.AddWithValue("$port", (object?)profile.Network?.Port ?? DBNull.Value);
        command.Parameters.AddWithValue("$database", (object?)profile.Network?.Database ?? DBNull.Value);
        command.Parameters.AddWithValue("$username", (object?)profile.Network?.Username ?? DBNull.Value);
        command.Parameters.AddWithValue("$file", (object?)profile.SqliteFileId ?? DBNull.Value);
        command.Parameters.AddWithValue("$key", (object?)profile.Secret?.KeyId ?? DBNull.Value);
        command.Parameters.AddWithValue("$nonce", (object?)profile.Secret?.Nonce ?? DBNull.Value);
        command.Parameters.AddWithValue("$cipher", (object?)profile.Secret?.Ciphertext ?? DBNull.Value);
        command.Parameters.AddWithValue("$tag", (object?)profile.Secret?.Tag ?? DBNull.Value);
        command.Parameters.AddWithValue("$revision", profile.Revision);
        command.Parameters.AddWithValue("$at", profile.ConfiguredAt.ToString("O"));
    }

    private async Task<SqliteConnection> OpenAsync(CancellationToken token)
    {
        var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync(token);
        return connection;
    }
}
