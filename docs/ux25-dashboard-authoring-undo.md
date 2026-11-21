# UX-25 — Dashboard authoring Undo and workflow clarity

Issue [#81](https://github.com/infoconex/analytics-dashboard/issues/81) · branch `ux25/dashboard-undo-workflow`. Baseline `main` `4bf6689e199884e818be18b7d4fca1cfc94b8beb` (UX-24 PR #80 merged, #79 closed).

## Existing implementation and problems

UX-24 provided an in-memory React dashboard draft, navigation/refresh warnings, explicit stale-revision recovery, responsive saved-template library controls and improved focus behavior. Reusable visualization templates are **organization-owned, revision-checked, and copied into inline independent dashboard widgets**. Dashboard Save/Cancel only controls dashboard state; Save to library, Edit template and Delete template persist independently. UX-21 persisted widget resizing/reordering; UX-22 added immediate chart previews and appearance configuration.

The authoring canvas exposes add, copy, duplicate, remove, pointer/keyboard reorder, resize and configure operations. Before UX-25, these directly replaced the React draft's widget list; one mistake required reapplying changes or canceling all work. The authoring heading had no Undo/Redo controls. Cancel from an editor launched from the visualization library returned to the dashboard, obscuring the user's previous navigation context. The <=480px visualization editor used a sticky Save/Cancel footer that could cover scrollable content.

## Alternatives and decisions

| Design | Decision | Rationale |
| --- | --- | --- |
| Single-level undo | Rejected | Insufficient after a sequence of authoring actions. |
| **20-step widget-array snapshot history, with Redo** | **Selected** | Small, bounded, reversible, simple to reason about, no server coupling. |
| Per-widget command/event sourcing | Rejected | Harder to cover order/layout/configuration consistently, with little gain for current scope. |
| Entire draft history per text keystroke | Rejected | Excessive snapshots and surprising Undo behavior when users edit dashboard names. |
| Cross-session, localStorage, IndexedDB, or server history | Deferred | Privacy, shared device, tenant switching, revocation, authorization, retention and schema issues need separate review. |
| Automatic conflict merge or forced-save revision | Rejected | Would weaken optimistic concurrency and risk overwriting another editor. |

## Implemented UX-25 behavior

### Widget Undo/Redo

`web/src/dashboardUndo.ts` implements pure immutable snapshot functions with a maximum of 20 steps. A new widget operation adds the preceding widget list to the undo stack, discards the redo branch, and updates only the **current in-memory dashboard draft**. No-op replacements are ignored. Snapshots preserve widget ID, order, kind, title, sample data selectors, appearance and layout. Appearance objects are copied, avoiding accidental sharing.

Tracked actions:
- Add new visualization after configuring it; add saved-template **independent copy**.
- Duplicate or remove an existing widget.
- Resize, move earlier/later, or drag-reorder a widget.
- Commit dashboard-widget configuration changes (one entry per editor submission).

Untracked:
- Dashboard name and description typing (native input Undo remains available).
- Unsaved intermediate changes inside open visualization dialogs.
- Creation, editing or deletion of saved visualization templates; these are independent persisted operations.
- Dashboard deletion, server updates, other browser tabs or session history.

The dashboard edit heading displays **Undo** and **Redo** with clear disabled states and an accessible widget-history group. Outside text fields and dialogs, Ctrl/Cmd+Z reverses a widget action; Ctrl/Cmd+Shift+Z and Ctrl+Y redo. The dashboard provides an accessible live announcement. Undo applies only to widget draft fields; dashboard name/description remain as typed.

### Lifecycle and concurrency

History begins empty upon entering dashboard edit mode, and is cleared when editing is canceled, dashboard Save succeeds, a navigation or organization switch occurs, or the user explicitly discards a conflicted draft to reload the latest revision. No browser storage is written. History never includes server revisions, reusable templates or other organizations' metadata.

On a stale dashboard Save, the server rejects the older expected revision, keeps the draft in memory and blocks Save until explicit recovery. Undo may still update the **local** conflicted draft, but cannot unblock or bypass server revision checking. The recovery reload remains an authorized organization-scoped GET followed by deliberate discard confirmation. No automatic merge, force overwrite or retry was introduced.

### Workflow and mobile clarity

- Library-launched template editing and library-launched new visualization creation now return to the library when the user Cancels. A successful template update continues to return to the library; committing a newly configured dashboard widget returns to dashboard editing.
- Dialog headings distinguish editing a dashboard copy from editing an independently saved template; descriptions clarify that only dashboard Save persists widget draft changes, whereas template Save persists immediately and changes **future** insertions.
- The visualization builder's narrow-screen sticky action footer was replaced by ordinary in-flow buttons. Mobile Undo/Redo controls wrap above Save/Cancel rather than obscuring chart content. UX-24's library footer and heading overflow fixes remain intact.

## Contracts, security and compatibility

No API, database schema, authentication, role, embedding or sample data changes. The client still requires an editor/owner role for authoring controls, and the server remains authoritative for tenant/role checks, dashboard/template updates and expected revisions. Viewers and sample embeds stay read-only. No global template catalog, shared live references, cross-tenant history, or production data sources are introduced.

Legacy dashboard widgets still use existing default layout/appearance rules, and the nine existing visualization types retain their fictional source-data semantics. Future hierarchical tenant permissions and fine-grained asset controls must be server-enforced for lists, reads, writes and rendered dashboards, not merely UI filtered.

## Automated and visual evidence

New Vitest cases (`web/src/dashboardUndo.test.ts`) cover preservation of independent identity/configuration, removal/reorder/layout restoration, no-op detection, invalidated redo branches, 20-step bound and history clearing.

New Chromium Playwright cases (`web/e2e/visualizationReuse.spec.ts`) cover duplicate/remove/reorder/resize/configure Undo/Redo, server update boundary, independent template save and Cancel-to-library returns, template copies in undo history, stale dashboard revision recovery, keyboard shortcut isolation, redo invalidation, and 320/390/720/768/1440px responsive toolbar/editor behavior. The suite attaches actual Chromium viewport screenshots of desktop undo/redo, conflict recovery, mobile toolbars and long-editor action placement, and uses axe checks at narrow widths. Existing UX-22 genuine 200%/400% Chromium tab-zoom tests and all UX-24 library/focus regression tests remain enabled.

### Measured verification and CI links

The verified **implementation commit** `00d9df7` passed all required checks in [Verify #44941905864](https://github.com/infoconex/analytics-dashboard/actions/runs/44941905864) and [CodeQL #44941905869](https://github.com/infoconex/analytics-dashboard/actions/runs/44941905869):

- **145 NUnit**, **118 Vitest**, **130 Chromium Playwright**, **20 UX-13/UX-14 evaluation lab** and **14 real SQL Server/PostgreSQL conformance tests** passed.
- TypeScript production build succeeded.
- C# and JavaScript/TypeScript CodeQL passed.
- Initial Chromium regression failures involved legacy dialog-title/sticky-footer expectations and an ambiguous duplicate-widget selector. These were corrected and the complete 130-test browser suite subsequently passed.

The documentation-only update has a later PR-head SHA and must independently finish its GitHub Actions checks before merging.

### Actual screenshot inspection

Downloaded the successful Chromium artifact [#14721499563](https://github.com/infoconex/analytics-dashboard/actions/runs/44941905864/artifacts/14721499563) and directly inspected **13 PNG screenshots** (not merely test assertions):

- Desktop Undo-ready and Redo states: widget copies, chart controls, Save/Cancel and the history group are readable and do not overlap.
- Stale-revision conflict after Undo: explicit recovery controls and disabled Save remain understandable.
- Dashboard toolbar and visualization editor at **320px, 390px, 720px, 768px and 1440px**: controls remain in flow, dialog actions can be reached by scrolling, and no document-wide horizontal overflow is visible.
- **Known visual limitation:** at 390px, the donut preview's external category labels can clip at the horizontal edges. The chart remains readable and a data-table alternative is available. Carry label-fitting/presentation refinement into UX-26 rather than broadening this undo/workflow increment.

Browser viewport/axe assertions complement but do not replace the direct image inspection. High-zoom and narrow-screen regression coverage remains enabled.

### Security and engineering review

PR diff review found no new HTTP endpoint, schema, template synchronization, client storage, auth grant, production data source, or embedding contract. Only bounded copied **widget descriptors** enter in-memory history, scoped to a single currently edited dashboard. Save still uses the original expected dashboard revision; the stale-save recovery path blocks Save until deliberately reloading an authorized current revision. Template writes still use independent server-authorized organization-scoped CRUD and revisions. There is no automatic conflict merging or hidden live reference. Local history is discarded on Save/Cancel/navigation/tenant change. The server remains the authority for editor/owner rights, tenant isolation and read-only viewer/embedded behavior. No material security findings or contract changes identified in code review; CodeQL completion is a separate required merge gate.

**Merge gate:** latest PR-head Verify and CodeQL must complete successfully before squash merge. The successful implementation-run screenshots have been inspected directly. After merge, verify fresh main-branch Verify and CodeQL results.

## Limitations

- Last 20 **widget operations** only. Dashboard metadata entry has standard text input undo but is not included in the dashboard widget toolbar history.
- No Undo across Save, Cancel, reload, refresh, browser crash, tenant switch or another user's session.
- No template CRUD Undo: independent template saves are not dashboard draft mutations.
- Repeated keyboard resize steps are individual history operations. Pointer resize commits once upon release.
- Revision conflict requires deliberate discard/reapplication; neither Undo nor Redo authorizes a stale server overwrite.
- No customer analytics data or local cached drafts are persisted by this feature.
- At 390px, outside donut slice labels can clip against narrow preview edges (UX-26 candidate); the chart data-table alternative remains available.

## Deferred consolidated product-owner review

Do not initiate immediate manual validation after UX-25. Later evaluate complete desktop/mobile dashboard creation/editing and all nine chart types; widget copy/duplicate/remove, resize and reorder; Undo/Redo; Save/Cancel/unsaved-navigation warnings; template reuse and independent saves/deletion; two-session conflicts; sample-data truthfulness; keyboard, touch, zoom and accessibility.

## Recommended UX-26

Prioritize another focused, practical visualization authoring improvement before consolidated manual review. Candidate: strengthen **widget edit discoverability, chart presentation consistency and narrow-screen dashboard rearrangement** through evidence-driven flows. Do not add extra visualization types or complex permission systems merely to match Kibana. Continue with one issue/branch/PR, verification, screenshot review and squash merge.
