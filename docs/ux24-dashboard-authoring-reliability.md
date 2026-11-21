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

The narrow-screen redundant bottom dismiss action is hidden at widths <=720px. Native `<dialog>` behavior retains Escape dismissal; the accessible labeled top-right Close control remains, with focus restored to the opening control on dismissal. At wider viewports the ordinary in-flow bottom action remains. The inner list stays scrollable and no new navigation controls are added. The native dialog keyboard trap excludes display:none controls; Tab from the final visible mobile action wraps to Close, while Shift+Tab returns to the final action. The 720px browser assessment additionally found the underlying dashboard heading's Save/Cancel actions extending beyond the viewport (right edge at 928px); the 950px-and-below edit heading now reflows its action group instead of creating page-wide overflow. Test at 320px, 390px, 720px, 768px and desktop; a 320px layout approximates 400% reflow on a 1280px CSS-pixel source width, and 720px approximates 200% on 1440px. These are **reflow checks**, not substitutes for an actual browser zoom inspection.

### Draft lifecycle and recovery

The dashboard and chart composition workflow stays in the current tab's React state. Browser persistence (localStorage, sessionStorage, IndexedDB) is **not** introduced: even an organization-keyed design would require answers about cache confidentiality, tenant-switch eviction, data retention, permission revocation, shared devices, versioned storage migrations, and cleanup. Persisting future customer data in local browser storage is not justified by the UX-24 evidence. Unexpected crashes and refresh after unload therefore still lose unsaved drafts. The existing navigation/beforeunload warning remains, and any 409 keeps the draft available in memory.

Recovery is user-directed. A stale dashboard PUT cannot overwrite the current revision. The editor remains open, Save is blocked until resolution, and the application performs a fresh **authorized**, organization-scoped dashboard GET for latest revision, name and visualization count. A user may inspect the local draft and either stay there or explicitly choose **Reload latest (discard draft)**. That action confirms loss, re-GETs the authorized latest version to avoid using stale fetched data, replaces only the dashboard's in-memory listing, and exits edit mode. A failed/forbidden GET does not reveal unseen details or discard the draft. No merge, forced revision change or automatic retry occurs.

### Saved-template concurrency

On template 409 or 404 during editing, local fields remain visible; the library is reloaded by an organization-scoped authorized list to distinguish revised versus deleted records. The editor focuses and scrolls the conflict recovery region into view so an editor at the bottom of a long chart preview does not miss the message. A revised template displays both revision numbers and allows **Reopen latest template (discard edits)** after confirmation. The next save requires the current expected revision. If the record was deleted or cannot be loaded, return to library is explicit and also requires confirmation. A failed library refresh reveals no unauthorized template metadata.

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

**Verified CI evidence, prior to the final template recovery-scroll refinement:** [Verify #44937759291](https://github.com/infoconex/analytics-dashboard/actions/runs/44937759291) passed with 145 NUnit, 114 Vitest, 20 evaluation lab, 125 Playwright, 14 real SQL Server/PostgreSQL conformance tests, and a production TypeScript build. [CodeQL #44937759228](https://github.com/infoconex/analytics-dashboard/actions/runs/44937759228) passed for C# and JavaScript/TypeScript. The **latest** PR-head verification, including the additional scroll/focus regression, remains mandatory before merge; use PR #80's Verify/CodeQL checks as the final status source.

**Actual Chromium screenshots personally inspected:** [UX-24 sample-only evidence artifact, Verify #44937759291](https://github.com/infoconex/analytics-dashboard/actions/runs/44937759291/artifacts/14721105446). The generated `ux23-ux24-library-*.png` views cover 320×640, 390×844, 720×850, 768×1024, and 1440×900. At 390px all four saved-template actions and top-right Close are individually visible, without the sticky footer from UX-23. At 320px the dialog has scrolled to show the final Edit/Delete actions, with no overlap or unintended horizontal overflow; the heading is above the current scroll position and accessible by scrolling or Escape dismissal. At 720px the library and all actions fit without overflow; at tablet and desktop the nonsticky in-flow Close library footer is separate from the card actions. The 1280×720 dashboard-conflict capture visibly shows preserved draft text, the current revision and explicit confirmed reload action.

**Screenshot-driven follow-up:** The first template-conflict screenshot was taken while the long editor dialog was scrolled to the bottom and did not visibly show the recovery region near its top. The follow-up focuses and scrolls that region into view automatically and adds viewport/focus assertions to the browser test. Review the latest Verify artifact to confirm that improvement. Screenshot inspection is a human visual check independent of passing geometry assertions.

**Engineering/security review:** no browser-side persistence of sensitive drafts; no new authentication or embed contracts; no cross-tenant catalog lookup; no optimistic-revision bypass; no automatic merge or overwrite. Refreshes are organization-scoped and server-authorized; a rejected GET retains only the user's in-memory unsaved draft and shows no other user's metadata. The generic dialog focus trap now ignores hidden controls. The code changes do not modify sample data calculations, server data schemas or authorization policies.

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
