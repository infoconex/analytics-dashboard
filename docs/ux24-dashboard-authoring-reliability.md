# UX-24 — Dashboard authoring reliability and visualization library refinement

Tracking issue: [#79](https://github.com/infoconex/analytics-dashboard/issues/79). Branch: `ux24/authoring-reliability`. Baseline: main `3b0e0354b4eca10661a5da572a12a9f8079e8288` (UX-23 PR #78 squash-merged).

## Existing behavior assessed

* The nine visualization types, their chart-specific appearance, sample interpretations and inline dashboard widgets remain unchanged.
* Saved visualizations are organization-owned **templates**, copied into dashboards with new widget IDs, independent appearance and default geometry. There is no live reference or provenance/usage index. Updates to the template affect **future insertions only**. Removing/deleting a saved template does not modify existing dashboard copies.
* UX-21 provides persisted dashboard resizing and reordering. UX-22 uses immediate visualization previews, an optional appearance panel, and dashboard Save/Cancel. UX-23 adds organization library search/filter/preview, Add copy, edit and delete.
* Dashboards are edited in in-memory React state. Unsaved change detection is based on name, description, widget identity/order/fields/layout/appearance. Internal navigation and unload warn when a dashboard draft has changed. Cancel discards, Save writes the expected revision. Navigation/refresh can destroy in-memory drafts; an interrupted session is not automatically recoverable.
* Both dashboard and library mutations are server-authorized, scoped by organization and revision-checked. On a stale dashboard revision, the UI previously retained the draft but showed only a generic 409. A stale saved-template edit kept fields open without a clear safe retry. A stale delete left the library listing out of date.
* UX-23's mobile `visualization-library-modal` rendered a bottom Close library control with `position:sticky; bottom:0; z-index:2` while saved cards sat in an independently scrollable `.library-items` container. At a 390×844 mobile viewport, the footer overlaid the last card's Edit template and Delete template actions. This is a real layering fault, not merely a reachability concern.

## Implementation decisions

### Mobile library

The narrow-screen redundant bottom dismiss action is hidden at widths <=720px. Native `<dialog>` behavior retains Escape dismissal; the accessible labeled top-right Close control remains, with focus restored to the opening control on dismissal. At wider viewports the ordinary in-flow bottom action remains. The inner list stays scrollable and no new navigation controls are added. Test at 320px, 390px, 720px, 768px and desktop; a 320px layout approximates 400% reflow on a 1280px CSS-pixel source width, and 720px approximates 200% on 1440px. These are **reflow checks**, not substitutes for an actual browser zoom inspection.

### Draft lifecycle and recovery

The dashboard and chart composition workflow stays in the current tab's React state. Browser persistence (localStorage, sessionStorage, IndexedDB) is **not** introduced: even an organization-keyed design would require answers about cache confidentiality, tenant-switch eviction, data retention, permission revocation, shared devices, versioned storage migrations, and cleanup. Persisting future customer data in local browser storage is not justified by the UX-24 evidence. Unexpected crashes and refresh after unload therefore still lose unsaved drafts. The existing navigation/beforeunload warning remains, and any 409 keeps the draft available in memory.

Recovery is user-directed. A stale dashboard PUT cannot overwrite the current revision. The editor remains open, Save is blocked until resolution, and the application performs a fresh **authorized**, organization-scoped dashboard GET for latest revision, name and visualization count. A user may inspect the local draft and either stay there or explicitly choose **Reload latest (discard draft)**. That action confirms loss, re-GETs the authorized latest version to avoid using stale fetched data, replaces only the dashboard's in-memory listing, and exits edit mode. A failed/forbidden GET does not reveal unseen details or discard the draft. No merge, forced revision change or automatic retry occurs.

### Saved-template concurrency

On template 409 or 404 during editing, local fields remain visible; the library is reloaded by an organization-scoped authorized list to distinguish revised versus deleted records. A revised template displays both revision numbers and allows **Reopen latest template (discard edits)** after confirmation. The next save requires the current expected revision. If the record was deleted or cannot be loaded, return to library is explicit and also requires confirmation. A failed library refresh reveals no unauthorized template metadata.

On template delete 409 or 404, the library is refreshed; the user is told to review the changed template and choose Delete again, or that the template was already deleted. The next delete again goes through confirmation and revision checks. Existing dashboard snapshots are never affected.

### Library clarity and save semantics

* **Add copy** adds an independent dashboard widget to the **unsaved dashboard draft**.
* **Save to library** creates a standalone organization template immediately, even when the dashboard remains unsaved; Cancel dashboard does not revert this independent save.
* **Edit template** saves library content independently; changed templates affect future insertions, not existing copies. **Delete template** likewise does not remove dashboard widgets.
* Failed actions retain current editor fields or library context and provide actionable text. Success toast clarifies template save versus dashboard Save.

## Alternatives considered

1. Automatically switch a stale draft to the latest revision and retry the same PUT: **rejected** (silently overwrites other editors' changes).
2. Three-way dashboard/widget merge UI: **deferred** pending conflict policies, provenance semantics, test coverage and product-owner direction.
3. Persist entire draft browser-side: **deferred** pending separate tenant-isolation, authorization revocation, retention, privacy and data-classification decision.
4. Shared live visualization refs / usage dashboard counts: **deferred**; existing copies cannot truthfully be presented as live dependencies. New provenance/persistence requires an explicit contract/security discussion.
5. Add a second mobile close action or complicated fixed footer: **rejected**; top-right native dialog dismiss control suffices.

## Contracts and enterprise boundaries

No API or persistence schema changes. The dashboard PUT and template PUT/DELETE still use expected revisions. GETs reuse existing organization-scoped authorization. No role, authentication, tenant hierarchy, embedding or production data-source behavior changed. Viewer remains read-only, and sample embed is still restricted. Future hierarchical organizations and fine-grained asset policies must be implemented **server-side**, for list/read, save/update/delete and final dashboard rendering rather than client-only filtering.

## Automated and visual evidence

UX-24 adds/updates Chromium Playwright scenarios in `web/e2e/visualizationReuse.spec.ts`: responsive library controls/scroll/close/focus, no horizontal overflow, selected axe accessibility checks, dashboard conflict with rejected and accepted discard, template edit 409 and delete 409 with independent dashboard copies. Existing Vitest, NUnit, browser, UX-13 evaluation lab, real SQL Server/PostgreSQL adapter conformance, and CodeQL workflows are retained.

Screenshot captures use native Chromium **viewport** screenshots rather than full-page dialog composites and are attached to the Verify run's `ux-visual-evidence` artifact. Inspection must compare actual rendered images; numeric geometry assertions are supporting evidence and **not** proof of visual quality.

**CI and actual screenshot inspection:** to be completed and documented after the PR's checks; do not treat an uninspected artifact as passed.

## Known limitations

* Browser refresh/crash cannot restore unsaved dashboard or unsaved template editor state.
* Dashboard conflicts intentionally require manual reapplication of desired edits after a deliberate reload; no copy of the losing draft persists automatically.
* Reopening a conflicted template discards the local version only after the user confirms.
* Optional usage context is not displayed because dashboard snapshot independence cannot establish a reliable live reference or current template-to-dashboard dependency.
* Real SQL Server/PostgreSQL conformance covers their existing restricted adapters; the organization library continues to use the existing SQLite application catalog.
* Automated browser tests do not establish customer-facing usability.

## Deferred consolidated product-owner review

**Do not initiate immediate manual review after UX-24.** Include: desktop/mobile dashboard creation, new and existing visualization configuration, Save/Cancel, template save/edit/delete/reuse/copy, widget duplication and removal, resize/reorder, navigation/refresh warnings, two-session concurrency, conflict discard/reapplication, keyboard focus, zoom/reflow, embed read-only, error recovery, and separation between dashboard versus independent template saves.

## Proposed UX-25

Focus on small authoring-flow simplifications and robustness supported by actual screenshot evidence. Evaluate better in-session undo/revert of recent widget operations, clear breadcrumbs when switching between dashboard and template editor, and accessible mobile edit dialogs. Before considering persistent recovery or asset usage tracking, run a focused security/data-retention/provenance design review and request product-owner approval for any material contract change.
