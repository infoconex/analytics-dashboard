using System.Text.Json;
using System.Text.Json.Serialization;
using AnalyticsDashboard.Application;
using AnalyticsDashboard.Domain;
using Microsoft.Data.Sqlite;

namespace AnalyticsDashboard.Infrastructure;

public sealed class SqliteCatalog(string databasePath) : IDashboardRepository, IOrganizationCatalog
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    private readonly string connectionString = CreateConnectionString(databasePath);

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS organizations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS memberships (
                organization_id TEXT NOT NULL REFERENCES organizations(id),
                user_id TEXT NOT NULL,
                role INTEGER NOT NULL,
                PRIMARY KEY (organization_id, user_id)
            );
            CREATE TABLE IF NOT EXISTS dashboards (
                id TEXT NOT NULL,
                organization_id TEXT NOT NULL REFERENCES organizations(id),
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                widgets_json TEXT NOT NULL,
                revision INTEGER NOT NULL,
                created_by TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (organization_id, id)
            );
            CREATE INDEX IF NOT EXISTS dashboards_updated
                ON dashboards (organization_id, updated_at DESC);
            """;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<(Organization Organization, OrganizationRole Role)>>
        GetOrganizationsAsync(string userId, CancellationToken cancellationToken)
    {
        var results = new List<(Organization, OrganizationRole)>();
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT o.id, o.name, m.role
            FROM memberships AS m
            JOIN organizations AS o ON m.organization_id = o.id
            WHERE m.user_id = $userId ORDER BY o.name
            """;
        command.Parameters.AddWithValue("$userId", userId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add((new Organization(reader.GetString(0), reader.GetString(1)),
                (OrganizationRole)reader.GetInt32(2)));
        }
        return results;
    }

    public async Task<OrganizationRole?> GetRoleAsync(
        string organizationId, string userId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT role FROM memberships
            WHERE organization_id = $orgId AND user_id = $userId
            """;
        command.Parameters.AddWithValue("$orgId", organizationId);
        command.Parameters.AddWithValue("$userId", userId);
        var value = await command.ExecuteScalarAsync(cancellationToken);
        return value is long role ? (OrganizationRole)role : null;
    }

    public async Task<IReadOnlyList<Dashboard>> ListAsync(
        string organizationId, CancellationToken cancellationToken)
    {
        var results = new List<Dashboard>();
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT id, organization_id, name, description, widgets_json,
                   revision, created_by, created_at, updated_at
            FROM dashboards WHERE organization_id = $orgId
            ORDER BY updated_at DESC
            """;
        command.Parameters.AddWithValue("$orgId", organizationId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(ReadDashboard(reader));
        }
        return results;
    }

    public async Task<Dashboard?> FindAsync(
        string organizationId, Guid dashboardId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT id, organization_id, name, description, widgets_json,
                   revision, created_by, created_at, updated_at
            FROM dashboards WHERE organization_id = $orgId AND id = $id
            """;
        command.Parameters.AddWithValue("$orgId", organizationId);
        command.Parameters.AddWithValue("$id", dashboardId.ToString("D"));
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadDashboard(reader) : null;
    }

    public async Task AddAsync(Dashboard dashboard, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO dashboards (id, organization_id, name, description, widgets_json,
                                    revision, created_by, created_at, updated_at)
            VALUES ($id, $orgId, $name, $description, $widgets, $revision,
                    $createdBy, $createdAt, $updatedAt)
            """;
        AddDashboardParameters(command, dashboard);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<bool> ReplaceAsync(
        Dashboard dashboard, int expectedRevision, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE dashboards SET name = $name, description = $description,
                widgets_json = $widgets, revision = $revision, updated_at = $updatedAt
            WHERE id = $id AND organization_id = $orgId AND revision = $expectedRevision
            """;
        AddDashboardParameters(command, dashboard);
        command.Parameters.AddWithValue("$expectedRevision", expectedRevision);
        return await command.ExecuteNonQueryAsync(cancellationToken) == 1;
    }

    public async Task<bool> DeleteAsync(
        string organizationId, Guid dashboardId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            DELETE FROM dashboards WHERE organization_id = $orgId AND id = $id
            """;
        command.Parameters.AddWithValue("$orgId", organizationId);
        command.Parameters.AddWithValue("$id", dashboardId.ToString("D"));
        return await command.ExecuteNonQueryAsync(cancellationToken) == 1;
    }

    public async Task SeedDevelopmentAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT OR IGNORE INTO organizations (id, name)
                VALUES ('northstar', 'Northstar Commerce'), ('isolated', 'Other Organization');
            INSERT OR IGNORE INTO memberships (organization_id, user_id, role)
                VALUES ('northstar', 'demo-owner', 2),
                       ('northstar', 'demo-viewer', 0),
                       ('isolated', 'another-user', 2);
            """;
        await command.ExecuteNonQueryAsync(cancellationToken);

        var existing = await ListAsync("northstar", cancellationToken);
        if (existing.Count > 0)
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var dashboard = new Dashboard(Guid.Parse("a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441"),
            "northstar", "Business performance", "Revenue, conversion and customer activity in one view.",
            [
                new(Guid.Parse("806e3063-18e9-4ddb-887a-229198c6dd01"),
                    "Total revenue", VisualizationKind.Metric, "commerce", "revenue", "month"),
                new(Guid.Parse("806e3063-18e9-4ddb-887a-229198c6dd02"),
                    "Revenue over time", VisualizationKind.Area, "commerce", "revenue", "month"),
                new(Guid.Parse("806e3063-18e9-4ddb-887a-229198c6dd03"),
                    "Orders by channel", VisualizationKind.Bar, "channels", "orders", "channel"),
                new(Guid.Parse("806e3063-18e9-4ddb-887a-229198c6dd04"),
                    "Traffic sources", VisualizationKind.Donut, "channels", "sessions", "channel"),
                new(Guid.Parse("806e3063-18e9-4ddb-887a-229198c6dd05"),
                    "Monthly orders", VisualizationKind.Line, "commerce", "orders", "month"),
                new(Guid.Parse("806e3063-18e9-4ddb-887a-229198c6dd06"),
                    "Channel details", VisualizationKind.Table, "channels", "orders", "channel")
            ], 1, "demo-owner", now, now);
        await AddAsync(dashboard, cancellationToken);
    }

    private async Task<SqliteConnection> OpenAsync(CancellationToken cancellationToken)
    {
        var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }

    private static string CreateConnectionString(string databasePath)
    {
        var absolutePath = Path.GetFullPath(databasePath);
        Directory.CreateDirectory(Path.GetDirectoryName(absolutePath)!);
        return new SqliteConnectionStringBuilder
        {
            DataSource = absolutePath,
            Mode = SqliteOpenMode.ReadWriteCreate,
            ForeignKeys = true,
            Pooling = true
        }.ToString();
    }

    private static Dashboard ReadDashboard(SqliteDataReader reader) => new(
        Guid.Parse(reader.GetString(0)), reader.GetString(1), reader.GetString(2),
        reader.GetString(3),
        JsonSerializer.Deserialize<List<DashboardWidget>>(reader.GetString(4), JsonOptions) ?? [],
        reader.GetInt32(5), reader.GetString(6),
        DateTimeOffset.Parse(reader.GetString(7), System.Globalization.CultureInfo.InvariantCulture),
        DateTimeOffset.Parse(reader.GetString(8), System.Globalization.CultureInfo.InvariantCulture));

    private static void AddDashboardParameters(SqliteCommand command, Dashboard dashboard)
    {
        command.Parameters.AddWithValue("$id", dashboard.Id.ToString("D"));
        command.Parameters.AddWithValue("$orgId", dashboard.OrganizationId);
        command.Parameters.AddWithValue("$name", dashboard.Name);
        command.Parameters.AddWithValue("$description", dashboard.Description);
        command.Parameters.AddWithValue("$widgets", JsonSerializer.Serialize(dashboard.Widgets, JsonOptions));
        command.Parameters.AddWithValue("$revision", dashboard.Revision);
        command.Parameters.AddWithValue("$createdBy", dashboard.CreatedBy);
        command.Parameters.AddWithValue("$createdAt", dashboard.CreatedAt.ToString("O"));
        command.Parameters.AddWithValue("$updatedAt", dashboard.UpdatedAt.ToString("O"));
    }
}
