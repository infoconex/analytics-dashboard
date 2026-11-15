using System.Globalization;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using Microsoft.Data.Sqlite;

namespace AnalyticsDashboard.Infrastructure;

public sealed class SqliteDataSourceRepository(string databasePath) : IDataSourceRepository
{
    private readonly string connectionString = CreateConnectionString(databasePath);

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS data_source_definitions (
                id TEXT NOT NULL,
                organization_id TEXT NOT NULL REFERENCES organizations(id),
                name TEXT NOT NULL,
                provider INTEGER NOT NULL CHECK (provider BETWEEN 0 AND 4),
                revision INTEGER NOT NULL CHECK (revision > 0),
                created_by TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (organization_id, id)
            );
            CREATE INDEX IF NOT EXISTS data_source_definitions_updated
                ON data_source_definitions (organization_id, updated_at DESC);
            """;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<DataSourceDefinition>> ListAsync(
        string organizationId, CancellationToken cancellationToken)
    {
        var definitions = new List<DataSourceDefinition>();
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT id, organization_id, name, provider, revision, created_by, created_at, updated_at
            FROM data_source_definitions WHERE organization_id = $orgId
            ORDER BY updated_at DESC, id
            """;
        command.Parameters.AddWithValue("$orgId", organizationId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken)) definitions.Add(Read(reader));
        return definitions;
    }

    public async Task<DataSourceDefinition?> FindAsync(
        string organizationId, Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT id, organization_id, name, provider, revision, created_by, created_at, updated_at
            FROM data_source_definitions WHERE organization_id = $orgId AND id = $id
            """;
        command.Parameters.AddWithValue("$orgId", organizationId);
        command.Parameters.AddWithValue("$id", id.ToString("D"));
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? Read(reader) : null;
    }

    public async Task AddAsync(DataSourceDefinition definition, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO data_source_definitions
                (id, organization_id, name, provider, revision, created_by, created_at, updated_at)
            VALUES ($id, $orgId, $name, $provider, $revision, $createdBy, $createdAt, $updatedAt)
            """;
        AddParameters(command, definition);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<bool> ReplaceAsync(
        DataSourceDefinition definition, int expectedRevision, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE data_source_definitions
            SET name = $name, revision = $revision, updated_at = $updatedAt
            WHERE organization_id = $orgId AND id = $id AND revision = $expectedRevision
            """;
        AddParameters(command, definition);
        command.Parameters.AddWithValue("$expectedRevision", expectedRevision);
        return await command.ExecuteNonQueryAsync(cancellationToken) == 1;
    }

    public async Task<bool> DeleteAsync(
        string organizationId, Guid id, int expectedRevision, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            DELETE FROM data_source_definitions
            WHERE organization_id = $orgId AND id = $id AND revision = $expectedRevision
            """;
        command.Parameters.AddWithValue("$orgId", organizationId);
        command.Parameters.AddWithValue("$id", id.ToString("D"));
        command.Parameters.AddWithValue("$expectedRevision", expectedRevision);
        return await command.ExecuteNonQueryAsync(cancellationToken) == 1;
    }

    private async Task<SqliteConnection> OpenAsync(CancellationToken cancellationToken)
    {
        var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }

    private static DataSourceDefinition Read(SqliteDataReader reader) => new(
        Guid.Parse(reader.GetString(0)), reader.GetString(1), reader.GetString(2),
        (DataSourceProvider)reader.GetInt32(3), reader.GetInt32(4), reader.GetString(5),
        DateTimeOffset.Parse(reader.GetString(6), CultureInfo.InvariantCulture),
        DateTimeOffset.Parse(reader.GetString(7), CultureInfo.InvariantCulture));

    private static void AddParameters(SqliteCommand command, DataSourceDefinition definition)
    {
        command.Parameters.AddWithValue("$id", definition.Id.ToString("D"));
        command.Parameters.AddWithValue("$orgId", definition.OrganizationId);
        command.Parameters.AddWithValue("$name", definition.Name);
        command.Parameters.AddWithValue("$provider", (int)definition.Provider);
        command.Parameters.AddWithValue("$revision", definition.Revision);
        command.Parameters.AddWithValue("$createdBy", definition.CreatedBy);
        command.Parameters.AddWithValue("$createdAt", definition.CreatedAt.ToString("O"));
        command.Parameters.AddWithValue("$updatedAt", definition.UpdatedAt.ToString("O"));
    }

    private static string CreateConnectionString(string databasePath)
    {
        var path = Path.GetFullPath(databasePath);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        return new SqliteConnectionStringBuilder
        {
            DataSource = path,
            Mode = SqliteOpenMode.ReadWriteCreate,
            ForeignKeys = true,
            Pooling = true
        }.ToString();
    }
}
