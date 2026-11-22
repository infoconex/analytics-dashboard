# UX-29 — Dashboard and visualization library discoverability

Issue [#89](https://github.com/infoconex/analytics-dashboard/issues/89). Baseline UX-28 main `ba0fcbe142ffc69543c7086c09292256e714f502`. Branch `ux29/catalog-library-discoverability`.

## Observed friction and targeted improvements

| Before | UX-29 |
| --- | --- |
| Dashboard cards use near-identical decorative thumbnails; similar titles are difficult to distinguish. | Each dashboard card identifies updated date, creator identifier, description and visualization count; names and descriptions wrap without clipping. |
| Dashboard listing used API order with no sorting. | Recently updated (default), Name A–Z and Name Z–A; deterministic ties, explicit count showing the current matches out of the authorized total. |
| Delete buttons appeared in a separate, duplicated *Manage dashboards* list. | Contextual, visibly labeled Delete on each dashboard card for authorized editors and owners, with the existing irreversible-action confirmation. |
| Saved visualization library could filter by type and search but gave neither result count nor a reset action. | Client-only multi-term search, type filter, sort order, clear filters, and accurate result count, including an actionable no-match state. |
| Reusable charts with similar names had few distinguishing cues; preview was distant from the chosen row. | Type, sample dataset, description, updated date and creator identifier on each template. Preview appears directly beneath the selected row; Add copy remains prominent. |

The catalog search uses whitespace-tolerant, case-insensitive AND matching against each item's title/name and description. It does not search across organizations or create an index. All controls and selections remain ephemeral in the browser; organization changes reset dashboard search and sort context.

## Persistence, authorization and architecture

- Existing organization-scoped API responses are the only input. Discovery filters foreign-organization records from results defensively, including dashboard detail selection. All existing authorization and API mutations remain authoritative.
- Library editing remains an immediate *template* operation using expected revision. Adding to a dashboard copies a template definition into an independent instance; Save changes is still required to persist that dashboard instance. Editing or deleting a template does not retroactively alter existing dashboard copies.
- The previous dashboard Delete confirmation and API operation are preserved. Editor/owner roles alone see the new card-local destructive action. Viewer roles remain read-only.
- No new backend, schema, index, permission, role, tags, folders, favorites, ownership model or stored preference. No changes to visualization rendering or SQL providers. The fictional sample-data labels remain clear.

## Evidence and reproduction

Vitest: `web/src/contentDiscovery.test.ts` covers multi-term searches, stable ordering, name ties, no matches, empty organizations, and foreign-organization exclusion for dashboards and reusable templates.

Playwright: `web/e2e/ux29Discovery.spec.ts` uses 36 fictional dashboards and 18 fictional saved visualizations plus deliberately injected foreign-scope records. It covers sorting, search, no-match recovery, viewer boundary, dashboard opening and return, independent copy, preview, accessible controls, and native Chromium screenshots at **320, 390, 720, 768 and 1440px**. Screenshots include catalog and selected inline library preview at each width; assertions check document overflow, dialog bounds, accessible results, and mobile axe checks.

Run all verification using `./scripts/verify.ps1 -IncludeBrowserTests` (the PR's Verify job). For a targeted browser retest, use the configured Playwright server setup and `npm run test:e2e -- e2e/ux29Discovery.spec.ts` from `web/`. The screenshot PNGs and Playwright traces are uploaded in the Verify workflow's `ux-visual-evidence` artifact, retained for 14 days. Human screenshot review must check text wrapping, action affordances, modal bounds, readable metadata and actual visual clipping; assertions alone do not prove readability.

## Product-owner review later

Keep representative UX-23 through UX-29 screenshots and reproduction steps for the deferred owner review covering discovery, dashboard creation, authoring, library reuse, layouts and desktop/mobile management. This increment is not owner signoff.

## Known boundaries

- The catalog does not introduce pagination or virtual scrolling. If a measured, authorized organization catalog becomes too large to render smoothly, that can justify a separate performance review; do not add a search service preemptively.
- Creator display uses existing `createdBy` identifiers. Resolving rich user profiles requires an explicit privacy, permission and API design review.
- Decorative dashboard thumbnails remain fictional/sample-only illustrations; metadata and description are authoritative identification cues.

## Verification log

Record final PR head, test results, screenshot inspection, real SQL Server/PostgreSQL and CodeQL findings, and post-merge main SHA once the workflows have run.
