# UX-27 — End-to-end dashboard authoring workflow refinement

Issue [#85](https://github.com/infoconex/analytics-dashboard/issues/85). Branch `ux27/dashboard-authoring-workflow`, baseline main `241d164083f6a7b568409ba113f456e3aff52b5b` (UX-26 PR #84).

## Workflow review and problems

The existing app supports nine kinds (metric, line, area, bar, donut, pie, histogram, scatter, table), dashboard create/edit, live previews, reusable organization-local templates, independent copies, duplicate/move/resize, 20-step widget Undo/Redo, draft warning, optimistic concurrency, and explicit server-authorized conflict recovery. UX-26 provided accessible mobile sizing and chart layout.

Trace of representative operations:

1. Dashboards → New dashboard → name/description → Create dashboard → dashboard view → Edit dashboard → Add visualization → kind/data/appearance/live preview → Add to dashboard → dashboard Save changes → reopen.
2. Existing dashboard → Edit dashboard → Edit widget → preview/configure → Update visualization (local draft) → Save changes (server).
3. Existing dashboard → Edit dashboard → Save widget to library (immediate organization-local write); Add saved visualization → Preview / Add copy (independent inline widget) → Save dashboard.
4. Add saved visualization → Edit template → Save template (immediate library write; existing dashboard copies unchanged), or Cancel (return to library).
5. Composition: duplicate, reorder, resize, Undo/Redo, Cancel (discard confirmation), or Save. Conflicts are blocked by expected revision, not auto-merged.

**Observed code defects (not user-reported anecdotes):**

- `dismissVisualizationEditor` cleared `widgetDraft` on Cancel, Escape, and Close even after substantive edits. `hasPendingWork` guarded navigation/refresh but not modal dismissal. This included changes to library templates and drafts awaiting explicit conflict recovery.
- The Create dashboard dialog's Cancel/Close/Escape could silently throw away entered metadata, even though navigation away from the form was warned.
- Several modal descriptions were accurate but verbose, and the builder had no compact persistent location context. "Update visualization" only staged local changes whereas "Save template" writes independently. The distinction is easy to miss while moving between the library and dashboard.
- No new visualization or backend behavior was needed to correct these issues.

## Targeted UX-27 implementation

- Added `authoringWorkflow.ts` pure change detection comparing original editor widget values and, when applicable, the saved-template description. The baseline is captured on opening a new/editor/library template and refreshed only after deliberate template conflict recovery. No browser storage, server sync or inferred cross-user edits.
- Cancel, Escape and Close now leave the editor visible when a modified widget/template is not explicitly discarded. Pristine editors close without prompts; a stale-template conflict also requires an affirmative discard. A rejected confirmation retains the data and conflict recovery control.
- A partially entered dashboard creation form now requires explicit discard, and a completed dismissal clears the transient form.
- The editor displays an accessible "Authoring location" trail distinguishing a dashboard copy/new widget from an independent reusable organization template, plus a concise persistence note. Existing dialog titles, gallery controls, keyboard handling and mobile action placement remain.
- After adding/updating a dashboard visualization, an accessible transient confirmation states that dashboard Save changes is still required. The template save feedback already identifies its separate persistence boundary; no synthetic success toast is shown for an unchanged widget.
- The existing independent copy-on-add implementation, optimistic concurrency, tenant scoping, Undo/Redo, nine visualization types, and sample-only embedded data are preserved.

## Tests and browser evidence

- Vitest `authoringWorkflow.test.ts`: pristine/clone equality; title/type/data/appearance/layout change detection; template-description edits/recovery.
- Chromium `visualizationReuse.spec.ts`: rejected Cancel/Escape, accepted Close, pristine Cancel; revised template description discard; library return and independent copy after save; dashboard create partial form with accepted/rejected Escape/Cancel; builder context and live preview/Cancel, screenshots at 320, 390, 720, 768 and 1440px; axe checks at 320 and 390; newly added widget Save/reload.
- Existing E2E cases that deliberately discard modified editors or a failed create form are updated to explicitly accept the newly required confirmation. No assertions or suites disabled.
- Screenshot attachments use the preexisting `ux-visual-evidence` GitHub Actions artifact (14-day retention), with viewport geometry, no horizontal page overflow, and native dialog bounds assertions. Inspect actual PNG files, not only filename lists, prior to merge.
- Full verification gate: 145 baseline NUnit, updated Vitest and Chromium counts, 20 evaluation lab tests, production build, real SQL Server/PostgreSQL adapter conformance, C# and JavaScript/TypeScript CodeQL. **Run results must be recorded from final PR head and post-merge main; do not treat this document as proof before those checks finish.**

## Security, reliability and architectural limits

No backend API, relational provider, database model, auth, tenant membership, server permissions, public embed or data access changes. An editor-visible template remains organization-local and must still pass server revision/authorization checks. No automatic retry/overwrite of conflicts. The in-memory baseline contains only already-visible sample-widget configuration; it is reset on dismissal/save and not cached across user or tenant sessions. The existing 20-step widget Undo stack remains separate from intermediate modal inputs.

## Remaining limitations / potential UX-28

- UX-27 does not implement persistent unfinished modal drafts, background save, global cross-template sharing, or concurrent automatic merge.
- Dashboard creation still first opens the saved dashboard view before Edit dashboard or Add first visualization; evaluate streamlining the first-time path with measured task evidence before changing the established tests/mental model.
- Longer sessions across multiple dashboards and real customer data-source admission must be evaluated separately, including explicit authorization and design review.
- UX-28 candidate: focused end-to-end first-dashboard activation and accessible authoring task guidance based on actual manual owner review and browser evidence; do not add new features without observed friction.

Manual product-owner review is deferred as requested.