using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

public sealed class DataSourceService(
    IDataSourceRepository definitions,
    IOrganizationCatalog organizations,
    IConnectionRepository connections,
    TimeProvider clock)
{
    public async Task<IReadOnlyList<DataSourceDefinition>> ListAsync(
        string organizationId, string userId, CancellationToken cancellationToken)
    {
        await RequireRoleAsync(organizationId, userId, false, cancellationToken);
        return await definitions.ListAsync(organizationId, cancellationToken);
    }

    public async Task<DataSourceDefinition?> FindAsync(
        string organizationId, Guid id, string userId, CancellationToken cancellationToken)
    {
        await RequireRoleAsync(organizationId, userId, false, cancellationToken);
        return await definitions.FindAsync(organizationId, id, cancellationToken);
    }

    public async Task<DataSourceDefinition> CreateAsync(
        string organizationId, string userId, DataSourceDraft draft, CancellationToken cancellationToken)
    {
        await RequireRoleAsync(organizationId, userId, true, cancellationToken);
        Validate(draft);

        var now = clock.GetUtcNow();
        var definition = new DataSourceDefinition(Guid.NewGuid(), organizationId, draft.Name.Trim(),
            draft.Provider, 1, userId, now, now);
        await definitions.AddAsync(definition, cancellationToken);
        return definition;
    }

    public async Task<DataSourceDefinition?> UpdateAsync(
        string organizationId, Guid id, string userId, DataSourceUpdate update,
        CancellationToken cancellationToken)
    {
        await RequireRoleAsync(organizationId, userId, true, cancellationToken);
        Validate(update);

        var existing = await definitions.FindAsync(organizationId, id, cancellationToken);
        if (existing is null) return null;
        if (existing.Revision != update.ExpectedRevision) throw new ConflictException();

        var next = existing with
        {
            Name = update.Name.Trim(),
            Revision = existing.Revision + 1,
            UpdatedAt = clock.GetUtcNow()
        };
        if (!await definitions.ReplaceAsync(next, update.ExpectedRevision, cancellationToken))
            throw new ConflictException();
        return next;
    }

    public async Task<bool> DeleteAsync(
        string organizationId, Guid id, string userId, int expectedRevision,
        CancellationToken cancellationToken)
    {
        await RequireRoleAsync(organizationId, userId, true, cancellationToken);
        if (expectedRevision < 1)
            throw new InvalidDataSourceException("Expected revision must be positive.");

        var existing = await definitions.FindAsync(organizationId, id, cancellationToken);
        if (existing is null) return false;
        if (existing.Revision != expectedRevision) throw new ConflictException();
        // An editor may delete metadata-only registrations, but must not bypass
        // owner-only credential revocation by deleting a connected registration.
        var isOwner = await organizations.GetRoleAsync(organizationId, userId, cancellationToken)
            == OrganizationRole.Owner;
        if (!isOwner && await connections.FindAsync(organizationId, id, cancellationToken) is not null)
            throw new ForbiddenException();
        // The repository checks this in the DELETE predicate too, so a profile
        // created concurrently cannot be removed by an editor between checks.
        if (!await definitions.DeleteAsync(organizationId, id, expectedRevision, cancellationToken,
                requireUnconfigured: !isOwner))
            throw new ConflictException();
        return true;
    }

    private async Task RequireRoleAsync(
        string organizationId, string userId, bool requireEditor, CancellationToken cancellationToken)
    {
        var role = await organizations.GetRoleAsync(organizationId, userId, cancellationToken);
        if (role is null || (requireEditor && role is not (OrganizationRole.Editor or OrganizationRole.Owner)))
            throw new ForbiddenException();
    }

    private static void Validate(DataSourceDraft? draft)
    {
        if (draft is null) throw new InvalidDataSourceException("A data-source definition is required.");
        ValidateName(draft.Name);
        if (!Enum.IsDefined(draft.Provider))
            throw new InvalidDataSourceException("Unsupported data-source provider.");
    }

    private static void Validate(DataSourceUpdate? update)
    {
        if (update is null) throw new InvalidDataSourceException("A data-source update is required.");
        ValidateName(update.Name);
        if (update.ExpectedRevision < 1)
            throw new InvalidDataSourceException("Expected revision must be positive.");
    }

    private static void ValidateName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Length > 100
            || name.Any(char.IsControl))
            throw new InvalidDataSourceException("Name must contain 1–100 printable characters.");
    }
}
