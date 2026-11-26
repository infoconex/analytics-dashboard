using AnalyticsDashboard.Domain;

namespace AnalyticsDashboard.Application;

public sealed class DashboardService(
    IDashboardRepository dashboards,
    IOrganizationCatalog organizations,
    TimeProvider clock)
{
    public async Task<IReadOnlyList<Dashboard>> ListAsync(
        string organizationId, string userId, CancellationToken cancellationToken)
    {
        await RequireMemberAsync(organizationId, userId, cancellationToken);
        return await dashboards.ListAsync(organizationId, cancellationToken);
    }

    public async Task<Dashboard?> FindAsync(
        string organizationId, Guid id, string userId, CancellationToken cancellationToken)
    {
        await RequireMemberAsync(organizationId, userId, cancellationToken);
        return await dashboards.FindAsync(organizationId, id, cancellationToken);
    }

    public async Task<Dashboard> CreateAsync(
        string organizationId, string userId, DashboardDraft draft, CancellationToken cancellationToken)
    {
        await RequireEditorAsync(organizationId, userId, cancellationToken);
        Validate(draft);

        var now = clock.GetUtcNow();
        var dashboard = new Dashboard(Guid.NewGuid(), organizationId, draft.Name.Trim(),
            draft.Description.Trim(), draft.Widgets, 1, userId, now, now);

        await dashboards.AddAsync(dashboard, cancellationToken);
        return dashboard;
    }

    public async Task<Dashboard?> UpdateAsync(
        string organizationId, Guid id, string userId, DashboardDraft draft,
        int expectedRevision, CancellationToken cancellationToken)
    {
        await RequireEditorAsync(organizationId, userId, cancellationToken);
        Validate(draft);

        var existing = await dashboards.FindAsync(organizationId, id, cancellationToken);
        if (existing is null)
        {
            return null;
        }

        if (existing.Revision != expectedRevision)
        {
            throw new ConflictException();
        }

        var next = existing with
        {
            Name = draft.Name.Trim(),
            Description = draft.Description.Trim(),
            Widgets = draft.Widgets,
            Revision = existing.Revision + 1,
            UpdatedAt = clock.GetUtcNow()
        };

        if (!await dashboards.ReplaceAsync(next, expectedRevision, cancellationToken))
        {
            throw new ConflictException();
        }

        return next;
    }

    public async Task<bool> DeleteAsync(
        string organizationId, Guid id, string userId, CancellationToken cancellationToken)
    {
        await RequireEditorAsync(organizationId, userId, cancellationToken);
        return await dashboards.DeleteAsync(organizationId, id, cancellationToken);
    }

    private async Task RequireMemberAsync(
        string organizationId, string userId, CancellationToken cancellationToken)
    {
        if (await organizations.GetRoleAsync(organizationId, userId, cancellationToken) is null)
        {
            // Do not distinguish absent organizations from inaccessible organizations.
            throw new ForbiddenException();
        }
    }

    private async Task RequireEditorAsync(
        string organizationId, string userId, CancellationToken cancellationToken)
    {
        var role = await organizations.GetRoleAsync(organizationId, userId, cancellationToken);
        if (role is not (OrganizationRole.Editor or OrganizationRole.Owner))
        {
            throw new ForbiddenException();
        }
    }

    private static void Validate(DashboardDraft draft)
    {
        if (draft is null)
        {
            throw new InvalidDashboardException("A dashboard definition is required.");
        }

        if (string.IsNullOrWhiteSpace(draft.Name) || draft.Name.Length > 100)
        {
            throw new InvalidDashboardException("Name must contain 1–100 characters.");
        }

        if (draft.Description is null || draft.Description.Length > 500)
        {
            throw new InvalidDashboardException("Description must not exceed 500 characters.");
        }

        if (draft.Widgets is null || draft.Widgets.Count > 24)
        {
            throw new InvalidDashboardException("Dashboards may contain at most 24 widgets.");
        }

        if (draft.Widgets.Any(widget => widget is null))
        {
            throw new InvalidDashboardException("Dashboard widgets cannot be null.");
        }

        if (draft.Widgets.Select(widget => widget.Id).Distinct().Count() != draft.Widgets.Count)
        {
            throw new InvalidDashboardException("Widget identifiers must be unique.");
        }

        foreach (var widget in draft.Widgets)
        {
            ValidateWidget(widget);
        }
    }

    /// <summary>Shared validation for inline dashboard widgets and saved visualization templates.</summary>
    public static void ValidateWidget(DashboardWidget widget)
    {
            if (widget.Id == Guid.Empty || string.IsNullOrWhiteSpace(widget.Title)
                || widget.Title.Length > 100 || !Enum.IsDefined(widget.Kind)
                || !ValidKey(widget.DatasetKey) || !ValidKey(widget.MetricKey)
                || !ValidKey(widget.DimensionKey))
            {
                throw new InvalidDashboardException("A widget contains invalid fields.");
            }
            // Bounded, optional visual layout metadata; old saved widgets remain valid.
            var minimumHeight = widget.Kind is VisualizationKind.Metric or VisualizationKind.Table ? 220 : 320;
            if ((widget.Columns is { } columns && (columns is not (3 or 6 or 9 or 12)
                    || (columns == 3 && widget.Kind != VisualizationKind.Metric)))
                || (widget.Height is { } height && (height < minimumHeight || height > 640
                    || (height - 220) % 20 != 0)))
            {
                throw new InvalidDashboardException("Widget layout size is invalid.");
            }

            if (widget.QueryDefinition is not null || widget.DatasetKey == FictionalQueryValidator.SourceKey)
                FictionalQueryValidator.Validate(widget);
            ValidateAppearance(widget);
    }

    private static void ValidateAppearance(DashboardWidget widget)
    {
        var appearance = widget.Appearance;
        if (appearance is null) return;

        var isPie = widget.Kind is VisualizationKind.Pie or VisualizationKind.Donut;
        var isCategorical = widget.DatasetKey == "channels"
            && widget.Kind is VisualizationKind.Bar or VisualizationKind.Pie or VisualizationKind.Donut;

        if (((appearance.ShowLegend.HasValue || appearance.ShowSliceLabels.HasValue
                || appearance.MaxSliceLabels.HasValue) && !isPie)
            || (appearance.MaxSliceLabels is { } max && max is not (5 or 8 or 12))
            || (appearance.HistogramBins is { } bins
                && (widget.Kind != VisualizationKind.Histogram || bins < 2 || bins > 12))
            || (appearance.CategorySort is { } sort
                && (!isCategorical || sort is not ("source" or "valueAsc" or "valueDesc"))))
        {
            throw new InvalidDashboardException("Visualization appearance settings are invalid for this chart.");
        }
    }

    private static bool ValidKey(string? value) =>
        !string.IsNullOrEmpty(value) && value.Length <= 64
        && value.All(character => char.IsAsciiLetterOrDigit(character)
            || character is '_' or '-');
}
