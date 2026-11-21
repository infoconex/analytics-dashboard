using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

/// <summary>Authorization and snapshot persistence for organization-owned visualization templates.</summary>
public sealed class SavedVisualizationService(
    ISavedVisualizationRepository repository,
    IOrganizationCatalog organizations,
    TimeProvider clock)
{
    public async Task<IReadOnlyList<SavedVisualization>> ListAsync(
        string organizationId, string userId, CancellationToken token)
    {
        await RequireRoleAsync(organizationId, userId, false, token);
        return await repository.ListVisualizationsAsync(organizationId, token);
    }

    public async Task<SavedVisualization?> FindAsync(
        string organizationId, Guid id, string userId, CancellationToken token)
    {
        await RequireRoleAsync(organizationId, userId, false, token);
        return await repository.FindVisualizationAsync(organizationId, id, token);
    }

    public async Task<SavedVisualization> CreateAsync(
        string organizationId, string userId, SavedVisualizationDraft draft, CancellationToken token)
    {
        await RequireRoleAsync(organizationId, userId, true, token);
        Validate(draft);
        var now = clock.GetUtcNow();
        // Ignore any incoming widget identity or dashboard geometry: the library is a template.
        var definition = draft.Definition with { Id = Guid.NewGuid(), Columns = null, Height = null };
        var saved = new SavedVisualization(Guid.NewGuid(), organizationId, draft.Description.Trim(),
            definition, 1, userId, now, now);
        await repository.AddVisualizationAsync(saved, token);
        return saved;
    }

    public async Task<SavedVisualization?> UpdateAsync(
        string organizationId, Guid id, string userId, SavedVisualizationDraft draft,
        int expectedRevision, CancellationToken token)
    {
        await RequireRoleAsync(organizationId, userId, true, token);
        Validate(draft);
        var previous = await repository.FindVisualizationAsync(organizationId, id, token);
        if (previous is null) return null;
        if (previous.Revision != expectedRevision) throw new ConflictException();

        var changed = previous with
        {
            Description = draft.Description.Trim(),
            Definition = draft.Definition with { Id = previous.Definition.Id, Columns = null, Height = null },
            Revision = previous.Revision + 1,
            UpdatedAt = clock.GetUtcNow()
        };
        if (!await repository.ReplaceVisualizationAsync(changed, expectedRevision, token))
            throw new ConflictException();
        return changed;
    }

    public async Task<bool> DeleteAsync(
        string organizationId, Guid id, string userId, int expectedRevision, CancellationToken token)
    {
        await RequireRoleAsync(organizationId, userId, true, token);
        if (expectedRevision < 1) throw new InvalidDashboardException("Expected revision is invalid.");
        if (!await repository.DeleteVisualizationAsync(organizationId, id, expectedRevision, token))
        {
            // Scoped read prevents leaking whether another organization's ID exists.
            if (await repository.FindVisualizationAsync(organizationId, id, token) is null) return false;
            throw new ConflictException();
        }
        return true;
    }

    private async Task RequireRoleAsync(string org, string user, bool edit, CancellationToken token)
    {
        var role = await organizations.GetRoleAsync(org, user, token);
        if (role is null || (edit && role is not (OrganizationRole.Editor or OrganizationRole.Owner)))
            throw new ForbiddenException();
    }

    private static void Validate(SavedVisualizationDraft draft)
    {
        if (draft is null || draft.Description is null || draft.Description.Length > 500
            || draft.Definition is null)
            throw new InvalidDashboardException("A visualization and description (at most 500 characters) are required.");

        DashboardService.ValidateWidget(draft.Definition);

        // UX-23 templates can only target already supported fictional samples.
        var w = draft.Definition;
        var validMetric = w.DatasetKey switch
        {
            "commerce" => w.MetricKey is "revenue" or "orders" or "customers",
            "channels" => w.MetricKey is "orders" or "sessions" or "conversion",
            _ => false
        };
        var validDimension = w.Kind == VisualizationKind.Scatter
            ? w.DimensionKey != w.MetricKey && (w.DatasetKey switch
            {
                "commerce" => w.DimensionKey is "revenue" or "orders" or "customers",
                "channels" => w.DimensionKey is "orders" or "sessions" or "conversion",
                _ => false
            })
            : w.DatasetKey switch
            {
                "commerce" => w.DimensionKey == "month",
                "channels" => w.DimensionKey == "channel",
                _ => false
            };
        if (!validMetric || !validDimension ||
            (w.Kind is VisualizationKind.Pie or VisualizationKind.Donut
                && w.DatasetKey == "channels" && w.MetricKey == "conversion"))
            throw new InvalidDashboardException("This visualization does not match an approved fictional sample or additive measure.");
    }
}
