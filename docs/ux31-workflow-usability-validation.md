# UX-31 — Dashboard and visualization workflow usability validation

Issue [#93](https://github.com/infoconex/analytics-dashboard/issues/93). Implementation branch `ux31/workflow-usability-validation`. Verified starting point: UX-30 main `e6577a5fd0543f5dc7e4e44225c830a485f719ab`, issue #91 closed, PR #92 squash-merged, post-merge Verify 44970740300 and CodeQL 44970740274 successful.

## Representative journey and observed friction

Reviewed the application state and routing code, saved visualization library, dashboard canvas, modal focus ownership, and existing UX-27–UX-30 browser suites. This source-driven assessment is not a claim of independent customer user-testing.

| Journey step | Specific pre-UX-31 friction | Targeted adjustment |
| --- | --- | --- |
| Dashboard discovery → view → edit | UX-30 already restores organization-local catalog query, scroll, focus, and editing state. | Retain; cover inside a longer real browser journey. |
| Add saved visualization → discover | Modal starts focus on "Create new instead"; search is not first, and loads asynchronously. | Initial focus targets Search when results render, including async fetch. Creation remains available but is secondary. |
| Library preview | Preview expands below the row in a scrollable dialog; the expanded chart may lie outside the visible mobile viewport. | Scroll the expanded preview into the nearest visible area while preserving keyboard focus on the Preview toggle. |
| Add copy → configure/edit → dashboard draft | A transient toast announces the change, but users may remain scrolled away from the newly added or edited chart. | Focus and scroll to the affected visualization heading after non-initial edits or adds. Retain UX-28's first-visualization focus on dashboard Save changes. Guard focus against dashboard/organization switches. |
| Save → another dashboard → return | Prior tests check separate flows, not one continuous cross-screen journey. | Add end-to-end Chromium exercises for all five required widths, including saving, reload, independent-copy checks, alternate dashboard, and return. |
| Empty dashboard → first meaningful chart | Already has a first-action guide and Save handoff. | Cover end to end and preserve the existing behavior. |

## Test matrix and evidence

`web/e2e/ux31Workflows.spec.ts` exercises a complete dashboard discovery, library search, preview, add-copy, chart configuration, save, navigation to a second dashboard, return, reload, and independent-copy check at 320, 390, 720, 768 and 1440 px. Additional five-width tests cover creating an empty dashboard and completing it with a first chart, including explicit Save handoff. Direct-link, viewer/organization isolation, and declined dirty Back are covered separately. The fixture is fictional, with a deliberately foreign dashboard and library template included in the northstar API payload to verify the client does not display or select them; this is not a substitute for backend authorization tests.

Screenshots: `ux31-discovered`, `ux31-library-preview`, `ux31-added-copy`, `ux31-saved-return`, and `ux31-first-visualization` for each viewport width, with horizontal page overflow assertions and targeted keyboard focus assertions. Playwright artifacts are retained as `ux31-workflow-evidence` and `ux-visual-evidence` on Verify (14-day retention). Review actual PNG pixels for dialog clipping, scroll position, headings, selection actions and toolbar legibility; automated geometry checks do not replace visual inspection or human usability research.

Existing regression coverage must continue: NUnit, Vitest, frontend production build, evaluation lab, all Playwright, and real SQL Server/PostgreSQL integration. Require both C# and JavaScript/TypeScript CodeQL checks; verify them again on final squash-merged main.

## First CI and browser review findings

Initial PR run [Verify #44976715802](https://github.com/infoconex/analytics-dashboard/actions/runs/44976715802) passed 145 NUnit, 132 Vitest, production build, UX lab, 14 real SQL Server/PostgreSQL integration, and 158/159 Playwright. Both CodeQL languages passed. One older UX-29 responsive accessibility test detected `color-contrast` while an expanded preview was visible: it is a genuine release blocker, not an ignored test.

Actual sample-only UX-31 screenshots at 320, 390, 720, 768 and 1440px were downloaded and inspected. The 320px expanded-preview image showed its top controls scrolled out of view despite Preview retaining DOM focus. The UX-31 correction scrolls the preview heading instead of the entire oversized panel to keep the invoking control visible, adds a positive Playwright in-viewport check for Preview, and increases Clear filters link contrast from approximately 3.86:1 to 5.09:1 on white. The AXE assertion now reports offending element snippets for actionable diagnosis if a remaining violation is exposed. No accessibility failures are waived. Repeat screenshot review on final PR head is mandatory before merge.

## Security and architecture

No server/API/schema, tenancy, persistence, authentication, data-provider, or embed behavior changes. All templates continue to be scoped to authorized organizations, added copies remain independent, and server-side role/revision checks remain authoritative. Focus restoration uses only transient DOM state and verifies the organization/dashboard; it cannot grant permissions or navigate through authorization. Existing unsaved-work prompts, conflict recovery, and navigation history remain unchanged.

## Limitations and possible UX-32 direction

This is scripted workflow validation using fictional data, not a measured usability study with actual customers. Real users, large/slow library fetches, embedded-host navigation, and assistive-technology tests beyond Playwright remain for future review. UX-32 should be chosen only after final UX-31 CI and screenshot findings; likely candidate: embedding-specific viewer navigation and return-context usability, if confirmed by evidence.

## Verification record

Populate from actual final PR and merged main: PR number, screenshots inspected and findings, .NET/Vitest/evaluation-lab/Playwright/SQL and PostgreSQL counts, CodeQL outcomes, merge SHA, and post-merge Verify/CodeQL run IDs. Do not treat the intended matrix above as a completed result before checks finish.
