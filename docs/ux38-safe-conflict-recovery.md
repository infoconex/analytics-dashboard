# UX-38 — Safe dashboard conflict review and draft recovery

## Goal and baseline

Editors can open a revision, edit dashboard metadata and inline visualization snapshots, and save with an expected-revision compare-and-swap. A stale save receives HTTP 409 and cannot change the server. UX-24 retained the unsaved in-memory draft and offered only a confirmed destructive reload. UX-25 widget undo/redo contains **widget snapshots only**, not metadata or revisions. UX-37 repair edits an individual dashboard-local visualization, not the reusable library template.

UX-38 adds an understandable comparison and opt-in selective reapplication, **not** an automatic three-way merge, auto-save, force update, or local draft persistence.

## Deterministic comparison

The comparison uses (A) the dashboard snapshot opened for editing, (B) the editor's in-memory draft, and (C) an authorized fetched latest saved dashboard. The original dashboard is not mutated by conflict review.

| Change unit | Editor's draft | Latest server | Outcome |
| --- | --- | --- | --- |
| Name / description | Changed | Unchanged | May reapply selected field |
| Name / description | Unchanged | Changed | Retain latest saved field |
| Same field | Same new value | Same new value | Already saved; no reapply |
| Same field | Changed differently | Changed differently | Overlap; manual reconcile |
| Widget-local copy A | Modified | Unchanged | May reapply **whole** A snapshot |
| Widget-local copy A | Unchanged | Modified | Retain server's A |
| Widget-local copy A | Modified | Modified differently | Overlap; manual reconcile |
| Widget-local copy A | Modified | Deleted | Overlap; manual reconcile |
| Widget-local copy A | Deleted | Modified | Overlap; manual reconcile |
| Widget-local copy A | Deleted | Unchanged | May reapply selected removal |
| New widget ID | Added locally | Missing remotely | May append selected widget, subject to 24-widget cap |
| New widget ID | Added both sides differently | Also present | Overlap |
| Widget order | Reordered locally | Any | **Never** automatically reorder; manually repeat |
| Widget order | Unchanged locally | Reordered remotely | Preserve latest saved order |
| Saved template reference | N/A | N/A | Dashboard widgets remain independent snapshots; never update library templates |

Whole-widget comparison includes kind, source key, metric, dimension, title, height, columns, and appearance. Optional empty appearance settings are normalized to their default absence for comparison. Additions are appended to the latest saved order; the draft's insertion point is not replayed. All original dashboard-local widget IDs remain distinct from library template IDs.

When a repaired visualization is changed independently, it can be selected for recovery without reintroducing unsupported configuration into unrelated widgets. When both editors change the same visualization, it is marked overlapping, even when the changes affect different fields inside that widget. This conservative policy avoids silently merging invalid combinations of layout, kind, metric and appearance.

## Editor workflow

1. A save receives HTTP 409. The editor's draft and widget undo/redo history remain as-is and Save is blocked.
2. The recovery region receives keyboard focus. The short summary identifies original and latest revisions plus independent, remote, overlapping, manual-order and already-saved changes.
3. Expanding **Review differences and choose edits to recover** exposes independently recoverable field/widget choices. Overlapping or order changes are described without a checkbox.
4. **Keep editing original draft** leaves the draft and original baseline intact but keeps Save blocked; Cancel/navigation/reload continue to require explicit discard confirmation.
5. **Recover selected edits** refreshes membership and the specific dashboard through existing authorized APIs. If access fails, the authoring draft is not changed and no new restricted content is shown. If revision/content changes, the draft remains intact and the user must review the new comparison.
6. The editor explicitly confirms discarding every unselected local change, including any unsupported reorder. Recovery creates a new *in-memory* draft over the **newest** authorized snapshot. The app discards incompatible widget undo/redo history, clears the conflict, and returns focus toward Save.
7. The editor reviews the result and separately clicks **Save changes**. The normal backend expected-revision check remains authoritative; a further concurrent save produces another HTTP 409 and restarts the same workflow.
8. **Reload latest (discard draft)** retains the existing explicit warning and re-fetches the latest authorized dashboard. No browser storage or persistence was added.

A local-only draft is **not** a capability token and never authorizes access to a deleted, inaccessible or changed dashboard. A viewer's read-only embedded experience has no edit or recovery affordances.

## Constraints and limitations

- No automatic application of field-level changes inside the same visualization; manual re-entry may be required.
- Local reorder is not replayed. Remote layout order is preserved; an added local visualization is appended.
- The 24-widget maximum and name/description length limits are checked before constructing a recovered draft. The final Save also executes all original server validations.
- There is no recovered-undo-history migration, browser-persisted draft, off-line recovery or cross-browser draft sharing. The original draft and its undo history survive a cancelled review, but a confirmed recovery starts a fresh undo history on the latest baseline.
- Latest-revision GET can fail due to deletion, revocation, or temporary errors; do not disclose a definitive cause or expose the newer dashboard in those cases.
- Full manual screen-reader usability and multi-device browser zoom are not established by automated accessibility scans.
- A newest-revision check cannot lock remote edits during the subsequent human review. A second conflict is safely blocked by the backend.

## Evidence and verification

Focused Vitest exercises metadata, independent/simultaneous widget edits, deletion-vs-edit, simultaneous field choices, layout and appearance, order, full-capacity additions, deep copies and identity validation. Playwright exercises real authoring controls, explicit recovery, no implicit write, second stale save, denied access, unavailable reads and multiple responsive/forced-colors viewports with axe. Retain full CI and security review before merging.

This is a client-side presentation and in-memory draft change; existing backend revision, organization scoping, API and SQL contracts remain unchanged.
