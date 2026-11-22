# UX-28 — First-dashboard activation and authoring continuity

Issue [#87](https://github.com/infoconex/analytics-dashboard/issues/87), branch `ux28/first-dashboard-activation`. Baseline `7fd7c6c175bb4518a9329fa441a7ae352c691955` (UX-27 PR #86).

## Verified problem and before/after path

UX-27 documented an unnecessary **View → Edit dashboard** transition after successful dashboard creation. The implementation confirmed that a new dashboard is already persisted via organization-scoped POST before navigating to its detail view. No backend changes are required to continue authoring immediately.

- **Before:** Dashboards → New dashboard → metadata → Create → saved dashboard view → Edit dashboard → Add visualization → configure → Add → Save.
- **After:** Dashboards → New dashboard → metadata → Create → **saved empty dashboard in composition mode** → choose Create visualization or Add saved visualization → configure or copy → Save changes → dashboard view.

The product does not automatically open a visualization configuration modal. A user may intentionally leave a dashboard empty.

## Targeted changes

1. A successful POST opens composition mode with a draft initialized from the **server-returned** dashboard and revision. The initial state is clean: Save changes remains disabled until the user changes dashboard metadata or widgets. Internal hash navigation no longer tears down state it has already initialized. External history navigation continues to invoke unsaved-work confirmation.
2. The zero-widget editing canvas has a short, accessible heading and two explicit actions: **Create visualization** and **Add saved visualization**. It says the dashboard itself is saved, later widget additions are only a local draft until Save changes, and Cancel can return to empty viewing. The large add tiles remain for nonempty composition only.
3. The first added or copied widget restores keyboard focus to **Save changes** as its previous empty-state action unmounts. A navigation focus target exists for the empty editing heading, with visible focus. Modal cancellation restores focus to the still-present empty-state trigger. Mobile actions stack without an off-screen toolbar. Screenshot inspection exposed a 320/390px activation problem: disabled Undo/Redo, a verbose clean-state notice, a sample toolbar, and a toast pushed or covered first actions. For a clean empty canvas, these are deferred and the page scroll resets to the top; actual history controls, unsaved-change notices, and sample freshness return when relevant.
4. Initial POST disables repeated creation while pending and preserves the creation dialog and user input on failure. All following edits continue to use the existing explicit update, expected-revision concurrency recovery, warning and Undo/Redo behavior.
5. Saved visualizations continue to be organization-local library templates; selecting one adds an independent dashboard copy. Sample-only embed, backend authorization, and access scoping are unchanged.

## Acceptance evidence

The `dashboardActivation.spec.ts` browser suite exercises:
- Five viewport widths: **320, 390, 720, 768 and 1440px**, each with create → clean editing → builder live preview → unsaved first widget → Save → reload, with screenshots of all stages and dimensions/overflow metadata.
- WCAG 2/2.1 AA automated checks for the empty state at 320 and 390px.
- A modified first-visualization cancellation (decline then confirm), clean empty-dashboard exit, persistent intentionally empty dashboard, reload and direct add-from-view.
- Organization library-first independent copy, preview, unsaved leave guard, explicit Save and reload.
- Rejected first-widget save followed by retry; draft and Save remain actionable.
- Existing E2E specifications updated for the new direct-to-edit contract; no tests removed.

Screenshots are published through the Verify workflow's `ux-visual-evidence` artifact (14-day retention). **Inspect actual PNGs** at all viewport widths and check any CI Playwright failures before merging, not only asserted geometry or screenshot filenames.

## Security and architecture

Only browser UI, tests, CSS, documentation and evidence-artifact upload paths changed. No authentication, tenant membership, backend API, storage, sample data or SQL/provider changes. No autosave, persistent drafts, automatic conflict resolution, permission bypass or global reusable chart sharing.

## Known boundaries and next review

- The *first* creation POST saves an empty dashboard, even if the user immediately cancels authoring. Deliberately leaving it empty is supported. Deleting it requires the pre-existing explicit Delete action.
- Rendering a new first widget **does not** persist it. Browser refresh/navigation while changed is still guarded by existing in-memory draft protection.
- Screenshots are automated sample-only evidence, not approval from the product owner. Extensive manual review remains deferred.
- Potential UX-29 focus: cross-dashboard discoverability, library organization at scale, or a focused owner-led workflow review based on the collected screenshots; avoid wizard-like additions without observed need.

## Verification log

Record final PR head and post-merge main results for NUnit, Vitest, UX lab, Playwright, production build, real SQL Server/PostgreSQL, CodeQL and screenshot inspection. Pending until actual workflow results are available.
