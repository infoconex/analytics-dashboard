# UX-39 — Dashboard save review and authoring confidence

## Design and scope

A dashboard editor's **Save changes** button commits the current dashboard draft using the
existing server-authorized, organization-scoped expected revision. UX-39 adds a compact
**Before you save** summary and an optional native disclosure on the editing page. It
does not add a mandatory modal, autosave, a new backend API, durable browser storage,
or a separate authoring baseline. The existing **Cancel**, navigation warning,
widget Undo/Redo and UX-38 conflict recovery remain authoritative.

The summary is computed on every render from the active authorized saved dashboard
and its in-memory draft. It uses `reviewDashboardConflict(baseline, draft, baseline)`,
the existing UX-38 snapshot comparison with the same baseline on both sides.
Only local changes are shown. The successful UX-38 recovery path already replaces
the saved baseline with the newly authorized revision before setting the recovered
draft, so the new review automatically excludes other editors' saved changes and
unselected local changes. A second stale save leaves the draft and review intact.

## Deterministic classification

| Before / draft | Pending change | Detail / count |
| --- | --- | --- |
| Same metadata and dashboard-local widgets | None | No pending-save disclosure |
| Name changed | Dashboard name | Original and draft values; one metadata change |
| Description changed | Dashboard description | One metadata change |
| New widget ID | Added: title | One added widget, even when copied from library |
| Original widget ID removed | Removed: original title | One removed widget; disclosed consequence |
| Existing widget ID changed | Updated: current title | One modified widget; detail may mention title, configuration, layout and appearance |
| Unsupported original configuration becomes supported | Updated: current title | Detail says repaired unavailable configuration; not an additional widget count |
| Surviving original IDs reorder relative to one another | Visualization order | One independent order change; not repeated for each moved widget |
| New widget added and removed before Save | None | Net result matches original |
| Edit then Undo to original snapshot | None | Net result matches original |
| Remote change appears in selected recovery baseline | None for that remote change | Selected reapplication only appears when actually different from latest |
| Library template saved during unsaved dashboard edit | Dashboard review unchanged | Template Save commits library only; dashboard remains draft |

The UX-38 whole-widget comparison normalizes known optional appearance fields so
missing legacy options do not count as meaningful edits. A title, configuration,
layout and appearance change to the same widget is **one** changed widget, with
several explanatory detail fragments. Purely added widgets may be placed anywhere,
but an extra reorder entry is not attributed to positioning those new widgets:
their saved position is the draft array order. Reordering among surviving original
IDs is reported independently. The review intentionally does not attempt a
field-by-field merge or introduce visual before/after diff canvases.

## Interaction and persistence

- A brief summary is shown while changes are pending; details are optional,
  keyboard accessible through native `details/summary`.
- The review always says the changes are **in the draft**; it never calls them
  saved or published. Only the original Save action writes to the server.
- A removal does not trigger an extra confirmation: Undo, Cancel and the explicit
  disclosure already explain how to avoid committing it.
- The separate **Save template** action writes a reusable library definition
  immediately, never the current dashboard copy or other dashboards.
- When Save succeeds, editing ends, pending indicators disappear and the existing
  saved toast appears. When Save fails or conflicts, no indicators are cleared.
- The review renders only for an authorized editor, using local already-loaded
  snapshots. This UI is not an authorization decision; backend checks are unchanged.

## Verification and limitations

Focused Vitest scenarios cover deterministic classification, no-op/undo,
repeated edits, repair, removal/reorder, legacy compatibility, independent
library copies and recovery onto a newer revision. Chromium scenarios cover
Save/Cancel, multi-widget work, temporary copies, repair, conflict recovery,
second conflict, failed Save, library Save, viewer/revocation, keyboard control,
1440/768/390/320 viewports, forced colors and genuine native Chromium 200%/400% tab zoom with screenshot and viewport/DPR evidence.
Automated axe scans check specified WCAG rule tags, not full conformance.

No claims of human usability studies, manual screen-reader testing or full
WCAG compliance. Native zoom is verified through the preexisting test-only Chromium extension rather than CSS scaling. Independent human zoom usability remains unverified. No live customer queries, new APIs or library references
are introduced.
