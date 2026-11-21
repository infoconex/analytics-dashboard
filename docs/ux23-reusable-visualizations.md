# UX-23 — Reusable visualizations and dashboard authoring workflows

Issue: [#77](https://github.com/infoconex/analytics-dashboard/issues/77). PR: [#78](https://github.com/infoconex/analytics-dashboard/pull/78). Branch: `ux23/reusable-visualizations`. Baseline: main `17e631cd545d679d6da2dd3a34fb2706baadaeec`.

## Existing system assessed

* `DashboardWidget` data and UX-22 appearance live inline in organization-scoped `dashboards.widgets_json` in SQLite. No independent visualization entity/catalog or widget references existed.
* API / application layers enforce membership for reads, editor/owner for writes, and compare revisions for updates. Widget count is bounded to 24; IDs are unique per dashboard. No server-side global visualization catalog.
* UX-21 dashboard width/height and drag-to-reorder are persisted with widgets. UX-22 supports optional appearance configuration, progressive disclosure, immediate sample-only preview, saved dashboard drafts, and Cancel.
* Existing dashboard discovery is not a saved-visualization library. Sample embed is intentionally read-only.
* Creating new visualizations already works; UX-23 does not rewrite the nine supported chart kinds.

## Reuse decision

**Copy-on-add snapshot**, not shared live references. Library entries are organization-owned templates; selecting one creates a new dashboard widget with a fresh ID and independent appearance object. The widget uses normal kind-dependent default layout on insertion, and may then be resized. Duplication *within* a dashboard preserves the current layout and appearance with a new widget ID and `(copy)` suffix. Existing inline dashboard widgets and old saved JSON need no migration.

Alternatives:
1. Live shared references would centralize edits but introduce unexpected dashboard-wide updates, cross-boundary authorization implications, missing-reference handling, revision consistency and significant integration design work. **Deferred; requires a new security/contract decision before implementation.**
2. Always duplicate and store inline avoids catalog work, but offers no cross-dashboard discoverability or independently curated templates. Rejected.
3. Independent organization library with copies provides safe, predictable first-use semantics without changing dashboards. **Selected.**

Editing or deleting a *library* template affects future additions only. Editing/removing dashboard widgets never edits/deletes the library. A library save/update/delete is committed immediately, independently of Save or Cancel on the dashboard; the UI states this explicitly. Editing a dashboard copy still requires dashboard Save. Removing a widget from the dashboard does not delete a saved template.

## Persistence, contracts and authorization

* New `saved_visualizations` SQLite table, composite primary key `(organization_id, id)`, foreign key to `organizations`, title embedded in `definition_json`, description, revision, created by and timestamps. `InitializeAsync` safely adds table/index using `IF NOT EXISTS`. Existing dashboard table, widget JSON and revisions are untouched.
* `SavedVisualization`, `SavedVisualizationDraft` and `SavedVisualizationUpdate` with organization-scoped list/find/create/update/delete routes under `/api/organizations/{organizationId}/visualizations`. Mutations compare optimistic revision; stale update/delete returns 409. No embed endpoint added.
* `SavedVisualizationService` enforces authorization before any lookup or metadata exposure; member list/read and editor/owner mutations. Repository lookup, update and delete are SQL-scoped by organization; unknown inaccessible organizations are indistinguishable to an unauthorized caller.
* A saved template strips dashboard geometry and incoming widget ID, accepts only bounded metadata and previously supported fictional sample fields, and validates chart-specific appearance. Nonadditive channel conversion pie/donut is rejected.
* No new identity, hierarchy, source admission, permissions protocol or production embedding. Future per-asset and hierarchical policy will require explicit server-side permission checks on both library access and dashboard rendering, not just UI filtering.

## User workflows

* On dashboard composition, **Add visualization** retains direct new-chart authoring. Adjacent **Add saved visualization** opens the organization library with text search, chart-kind filter, preview, clear empty/error/loading states, and Add copy.
* Existing widgets gain Duplicate and Save to library. The save dialog allows a distinct title and description, and explains independent template persistence.
* Library management allows editing saved template in the established chart builder, with preview and UX-22 appearance controls, or deleting it after confirmation. Existing dashboard copies remain unchanged.
* Dashboard Save/Cancel, reload, ordering and resize behavior retain their prior semantics. The original nine kinds and sample-data interpretations are unchanged.

## Automated coverage and evidence

* NUnit `SavedVisualizationTests`: persistence, appearance round-trip, legacy dashboard independence, membership, viewer write-denial, cross-org isolation, invalid sample/appearance rejection, conflict handling and API contract.
* Vitest `composition.test.ts`: independent copies, layout handling, duplicate insertion/order and safety bounds, existing dirty detection.
* Playwright `visualizationReuse.spec.ts`: cross-dashboard copy independence, save/edit/delete intent, search/type filtering, visual preview, reload, duplicate, cancel, viewer restrictions, empty state, axe checks, desktop (1440×900) and mobile (390×844) screenshot capture.
* CI: `.github/workflows/verify.yml` runs TypeScript production build, Vitest, NUnit, Chromium Playwright and mandatory SQL Server/PostgreSQL conformance; `codeql.yml` analyzes C# and TypeScript.
* Viewport screenshots of native dialogs are captured by real Chromium (rather than misleading full-page compositor composites) into `web/test-results/visualizationReuse-*/ux23-*.png` and attached to the Verify run's `ux-visual-evidence` artifact. Inspect actual images before claiming a visual pass.
* Pre-documentation-update CI: [Verify run 44931853539](https://github.com/infoconex/analytics-dashboard/actions/runs/44931853539) succeeded: **145 NUnit**, **114 Vitest** (17 files), **122 Playwright**; mandatory SQL Server/PostgreSQL adapter conformance passed. [CodeQL run 44931853544](https://github.com/infoconex/analytics-dashboard/actions/runs/44931853544) succeeded. No blocking security findings were reported by that run.
* Real Chromium screenshots directly inspected from the [visual-evidence artifact](https://github.com/infoconex/analytics-dashboard/actions/runs/44931853539/artifacts/14718436134): `visualizationReuse-*/ux23-desktop-library-and-preview.png`, `ux23-mobile-library.png`, and `ux23-empty-library.png`. The library and preview were readable, desktop modal contained its controls, mobile UI stacked correctly in a scrollable modal, and empty state identified how to create a reusable chart. Screenshot assertions also checked no horizontal document overflow and in-viewport dialog boundaries.
* This documentation-only evidence update triggers fresh branch checks; use the latest PR head checks before merge. Post-merge run URLs and final main SHA are verified separately.

## Constraints and known limitations

* The saved visualization library is a small catalog available while composing a dashboard, not a standalone asset-management product. No tags, folders, global library, ownership transfer, usage index or hierarchical organization policies.
* Snapshot changes do not propagate to other dashboards. Updating a saved template only changes future copies.
* Library save is independent of unsaved dashboard draft, intentionally; communicate this at the save point.
* Real SQL Server/PostgreSQL conformance continues testing restricted adapters, not the SQLite catalog table.
* No person-facing usability claim is based on automated tests.

## Deferred consolidated product-owner review

**Do not request immediate manual review.** Later review the full authoring sequence: new/edit/change type, source and chart appearance, saved library creation/discovery/filter/preview/copy, dashboard duplication/reordering/resizing/remove, library edits versus existing copies, Save/Cancel/reload/conflict recovery, keyboard and mobile; confirm meaningful labels/empty states/errors and embed read-only behavior.

## UX-24 recommendation

Continue dashboard and visualization workflow quality with a **consolidated authoring reliability increment**: draft recovery and conflict handling, keyboard-accessible selection shortcuts, catalog usage indication (without introducing implicit shared refs), plus broader desktop/mobile error and responsive checks. Preserve simple-by-default interaction and fictional sample semantics. Defer permissions hierarchy, production data sources and shared live references to separately approved security/architecture work.
