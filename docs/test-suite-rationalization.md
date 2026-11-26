# Regression effectiveness audit

Status: **audit implementation verified at abae9e8; final documentation head and post-merge verification pending** (issue #142). The source baseline is `09a623eed301c12c112b1a5be056143de7a18781` on experiment/dashboard-filtering; main is `4ef243a60748a694afd6e52e192dc273e99565fb`. No product changes are authorized.

## Method and baseline

Review actual assertions and exercised boundaries, then compare coverage across layers. Default to retaining cases unless the equivalent failure signal is established. A title, repeated assertion, or execution cost alone is insufficient evidence of duplication. Record source references, replacement assertions, timing variability and residual risk. Distinguish a standing regression test from scripted evaluation evidence. Do not weaken required CI, security, provider or accessibility checks.

Integrated run [45490259682](https://github.com/infoconex/analytics-dashboard/actions/runs/45490259682) passed in 238 seconds. CodeQL run 45490259648 passed. Measured baseline counts from job logs: 222 browser tests in 29 files; 195 frontend tests in 26 files; 180 backend tests; 19 relational/MySQL provider cases and 3 Elasticsearch cases in provider job (22 total; backend explicitly excludes ProviderIntegration and ElasticsearchIntegration categories); 20 lab guards; 18 Python impact/cache orchestration tests in planning; Compose integration passed. Browser planner has five standing node:test declarations; verify-browser runs them as part of browser verification. Sum of CI job start-to-completion intervals was 1,385 seconds (23m05s), of which six browser jobs consumed 1,162 seconds (19m22s); this is elapsed job time, not billed minutes.

### Multi-run browser timing

All six archives for each run were downloaded and their Playwright JSON reports, phase reports and selected IDs inspected. Each run contains 222 distinct executed cases and 222 distinct planned IDs, 29 files, zero skips, failures or reported flakes. No timing claim here represents an after-change benchmark.

| Run | Case duration sum | API restore | API build | npm ci | Linux dependencies | Chromium prepare | Playwright with startup |
|---|---:|---:|---:|---:|---:|---:|---:|
| 45490259682 | 601.5s | 95.0s | 61.9s | 25.3s | 136.4s | 3.6s | 649.4s |
| 45489439513 | 566.0s | 65.8s | 44.4s | 20.7s | 154.1s | 3.5s | 616.6s |
| 45416624860 | 608.9s | 70.9s | 53.1s | 23.5s | 153.6s | 3.6s | 660.7s |

Times above are sums across shards, not workflow elapsed time. Across runs, each archive set contained 734 PNG entries (approximately 120 MB uncompressed; includes duplicate attachment copies, not necessarily unique screenshots). Measure screenshot cost before changing collection or retention.

| Expensive case | Three observations (seconds, in run order above) | Current disposition |
|---|---|---|
| 18-widget embedded index return and host scroll | 16.880 / 14.558 / 15.311 | Keep: actual iframe scroll and precise focus, five widths, filtered state and reload |
| Mixed 18-widget filter scope | 14.857 / 14.694 / 14.504 | Review pending; cross-dataset assertions must survive |
| Mixed 12-widget availability | 12.892 / 11.297 / 8.535 | Review pending; distinct error and partial-result states |
| New dashboard first-save five widths | 10.908 / 10.175 / 10.919 | Review pending |
| Host scrolling and disclosure resize | 12.824 / 10.858 / 7.855 | Keep: real iframe sizing, expand/collapse, mobile dialog placement |
| Scripted navigation and recovery | 8.674 / 7.408 / 10.899 | Review pending |
| Responsive repair | 7.841 / 8.367 / 9.687 | Review pending |
| Narrow numeric tables | 8.590 / 7.507 / 7.946 | Keep: real table region keyboard horizontal scroll and no nested vertical scroll, data values, focus, axe |

Slowest file median: visual.spec.ts 72.307s; visualizationReuse.spec.ts 58.125s; customerTasks.spec.ts 28.533s; ux31Workflows.spec.ts 28.151s. Cost does not establish redundancy.

## Confirmed retirement: obsolete headless keyboard zoom attempt

Source: web/e2e/visual.spec.ts at baseline, test 'browser zoom attempts report genuine viewport changes rather than treating CSS reflow as zoom'. Originally an exploratory attempt to reach native zoom with Control+Equal. Its overflow check runs only if a changed CSS viewport and DPR happen to be observed. Its only unconditional assertion is `expect(observed).toHaveLength(observed[0]?.achieved ? 2 : 1)`. All three reports recorded width 1280 and DPR 1 before and after attempting 200%, achieved=false, passed; no 400% attempt and no overflow assertion. Measured durations 1.242s / 1.201s / 1.715s. Historical JSON attachment remains in baseline evidence archives.

Surviving test in same file: 'browser-native zoom at 200% and 400% preserves the 12-widget keyboard and filter journey'. Same standalone dense fictional dashboard and real Chromium boundary, but uses Chromium's tab zoom extension and requires actual factor, viewport change, DPR ratio and automatic zoom mode, then checks document overflow, control geometry, exact index focus, accessible keyboard journey, real data and filter recovery. A missing zoom change (the state observed in all three old test runs) cannot satisfy `expect(genuineZoom).toBe(true)`; a genuine zoom overflow fails `assertNoDocumentOverflow`. Both target levels must execute. Separate embed.spec.ts native zoom test remains, as do other product-specific native zoom cases. This is a static failure-signal comparison and historical negative observation, not an executed injected defect. Residual risk: not a test of physical browser UI keyboard shortcuts; the retired CI attempt never established that capability and the shortcut is browser-owned. Preserve historical reports; don't retain a passing probe as a required regression test. Expected browser count after this change: 221; exact-head verification pending.

## Reviewed coverage groups: embedded and standalone navigation

The following are assertion-level initial dispositions, not a blanket declaration that every other case is necessary.

| Source / case | Boundary, assertions and risk | Disposition |
|---|---|---|
| embed.spec.ts: host integration | Mock API, actual iframe and HTTP frame headers; no edit/create controls; same-origin, tab entry/exit, filter removal focus, zero writes | Keep: frame security and keyboard boundary |
| embed.spec.ts: dense direct navigation | Direct embed, 12 widgets, native End/Tab/Enter, exact return focus and open index, no writes | Keep: direct embed keyboard differs from host click navigation |
| embed.spec.ts: empty/error/retry/invalid | Mock 503, retry, invalid path and denied organization, no unauthorized controls | Keep: direct embed error UI |
| embed.spec.ts: mobile/narrow/forced colors | Direct embedded layout at 390/320, working filters, axe, host no overflow | Keep pending consolidation review; host sizing tests don't establish direct embed layout |
| embed.spec.ts: actual API denies cross-tenant | Real development API 403 for known other-tenant dashboard and 404 for absent permitted ID | Keep: deployed/dev-seeded API boundary; backend integration has similar statuses but different runtime setup |
| embed.spec.ts: documented host actual API | Real seeded API plus iframe, Direct exact row 1,530, clear restores 5, no writes | Keep: deployed runtime UI data path |
| embed.spec.ts: native zoom | Real Chromium extension at 200/400%, DPR/viewport, no overflow, focus and filter | Keep |
| embed.spec.ts: saved appearance | Mock stored configuration to read-only embedded rendering; slice labels, hidden legend, sorted categories, histogram bins, mobile overflow, no writes | Keep pending lower-layer appearance review; embedded renderer boundary |
| consumer.spec.ts: independent filters | Real default page path; revenue changes while channel data unchanged, independent resets, legend/table selection, 5 to 1 to 5 rows | Keep: actual UI wiring; lower-level consumerFilters tests verify deterministic row selection separately |
| consumer.spec.ts: keyboard category | Enter/Space toggle, status and pressed/focus state | Keep: keyboard interaction |
| consumer.spec.ts: click bar | Actual SVG chart bar pointer toggles filter and rendered bar count | Keep: chart library pointer event |
| consumer.spec.ts: mobile filter | 390px body width, filter operability, editor availability | Keep pending responsive review; distinct standalone state |
| consumer.spec.ts: viewer | Mock organization viewer; no edit, Referral changes table and chip | Keep: UI role control (not substitute for server authorization) |
| consumer.spec.ts: navigation reset | Back/reopen and reload reset filters | Keep: standalone navigation intentionally differs from host persistence; baseline title claims no saved mutation but does not inspect mutation requests; improved by observing API requests before the filtering journey and asserting no non-GET /api/ requests after navigation and reload |
| consumer.spec.ts: recovery focus | Enter on chip and reset, status, table count, independent period/channel and focus restoration | Keep: focus/announcement across control disappearance |
| ux32EmbedNavigation.spec.ts: switch and history | Mock two authorized dashboards; iframe hash, per-dashboard filters, focused host links, overview, browser back/forward, no writes | Keep: actual browser history |
| ux32EmbedNavigation.spec.ts: deep links | Valid second dashboard reload, invalid selection hides iframe, authorized recovery, direct URL filter round trip | Keep: actual route integration |
| ux32EmbedNavigation.spec.ts: unavailable list | 503 list retry, distinct 403 and 404 in iframe, no edit | Keep: host discovery and distinct error responses |
| ux32EmbedNavigation.spec.ts: four widths | Short host and iframe no horizontal overflow, axe at final width | Keep pending responsive consolidation; short vs dense and forced-colors states differ |
| ux32EmbedNavigation.spec.ts: real API | Actual seeded list includes both IDs, known other tenant 403, actual second iframe view | Keep: seeded runtime |
| ux33EmbedContinuity.spec.ts: long host sizing | Actual iframe 12 widgets across 4 widths, host-owned scroll, disclosure expand and shrink, mobile dialog in viewport, no writes | Keep |
| ux33EmbedContinuity.spec.ts: reload | Same-tab reload per-dashboard filters, focus and host return, content-sized frame | Keep: reload persistence not merely navigation |
| ux33EmbedContinuity.spec.ts: reauthorization | Reload after 403 clears iframe to about:blank; only list request, retry restores authorized filter, unavailable second ID denied, no writes | Keep: fail closed, no cached pre-render |
| ux33EmbedContinuity.spec.ts: empty shrink | 390px host empty sizing, forced-colors axe, direct empty URL retains allowed query but no control, no writes | Keep: empty state distinct from dense |
| ux34DenseWayfinding.spec.ts: deep index | Actual host 18 widgets, five widths, exact index/return focus, geometry, host scroll, persisted filter | Keep |
| ux34DenseWayfinding.spec.ts: table readability | Narrow real table region horizontal-only keyboard scroll, exact values and headers, chart details, forced-colors outline and axe | Keep |

Lower layer mapping: web/src/consumerFilters.test.ts verifies exact deterministic row selection, source immutability, compatible counts, unknown dataset handling and category toggling; embedRoute.test.ts validates parsing/formatting and allowed filter keys; sampleHostRoute.test.ts validates host paths and organization-scoped GUID records. DashboardApiTests.cs KnownDashboardIdentifierCannotBypassOrganizationBoundary asserts OK/Forbidden/NotFound with known identifiers, while MembershipLimitsApiAccessToOneOrganization verifies membership restriction. These do not replace real iframe, browser history, DOM focus, browser geometry, or dev-seeded runtime tests. No security test removed.

## Confirmed assertion improvement: read-only consumer filtering

The standalone consumer reset test previously only checked cleared filters, which could pass even if filtering incorrectly issued a mutation. A page request listener now records non-GET /api/ calls before selecting the filter; the test asserts an empty list after navigation and reload. A PUT/PATCH/POST/DELETE request from that journey now produces a nonempty list and fails. This is a static failure-signal comparison; exact-head execution is pending. The test remains at the actual browser/API request boundary. No existing assertion was removed. This does not replace server authorization or database integrity tests.

## Remaining work and architecture guidance

Keep tests at lowest appropriate layer; preserve actual real browser behavior and deployed boundaries. New regression scenarios should identify the failure they protect and consult existing assertions, extend an existing case when safe, avoid coupling mutable fixtures, and use accessible selectors. Keep manual comparison and evaluation-only probes separate from required regression verification. Successful screenshots are diagnostic evidence, not automatically an assertion; preserve unique visual evidence and investigate collection overhead separately. Do not assume fixed timeout ceilings are waits.

Remaining: complete source-case inventory for all standing layers; review visualization and authoring groups against deterministic logic, API/provider, Compose, lab and gate tests; measure screenshot overhead and repeated setup; assess coverage gaps; refresh timing only if justified; verify final head, compare after timing and runner consumption, review diff and verify post-merge before closing issue. No parallelism, production behavior or CI gate change in this initial increment. No EXP-03 work.


## Preliminary standing-suite source inventory

The companion files in [test-audit](test-audit/) index the baseline source by capability, file, blob SHA, declaration, assertion excerpts and (for browser cases) boundary-related lines. They cover 29 browser files (205 declarations, 222 discovered/executed cases including parameterized variants), 26 frontend test files, 21 backend test files including provider conformance, CI planning/cache and shard tests, Compose smoke, and lab guards. These are machine-assisted source indexes, not evidence of completed semantic disposition. Multi-line assertions, helper behavior, setup, parameterized variants and per-case timings still need reconciliation. The per-executed-case browser timing CSV was delivered separately; the historical CI artifacts remain the canonical measurements.

Additional initial group findings:
- Frontend logic: deterministic filtering, date/time boundaries, display/formatting, composition, undo, conflict, routing and discovery checks exercise pure functions or component contracts inexpensively. Browser coverage of those features does not replace those inputs and edge cases.
- Backend application/API: retain HTTP authorization/status/serialization checks separately from service membership, stale revision, persistence, repository scope and atomic mutation tests. Keep the query planner's approved-field mapping, fail-closed applicability, typed bounds and pre-aggregation predicates. Validation is not live execution.
- Connection security: destination/DNS policy, cryptography, credential lifecycle, transport authorization, revocation and cancellation exercise different failure surfaces. Preserve all pending full review.
- Providers: compiler SQL/DSL and native parameter construction assertions complement actual database execution, NULL/literal semantics, UTC bounds, aggregation, read-only principals and injection checks. Preserve per-provider differences; no mocks substitute for live conformance.
- CI/lab/deployment: maintain fail-closed impact and gate logic, exact shard inventory verification, fixture provenance, network confinement and safe evidence handling. Compose smoke uniquely checks proxy/readiness, authorization and lack of published backend port.
- Potential evaluation-only candidates: broad screenshot-heavy desktop/mobile/tablet scenarios in visual.spec.ts. Some include real overflow, navigation or error assertions and are invoked by manual evidence commands. Do not move or remove until each assertion and manual command is mapped to retained coverage and evidence generation is separately measured.

The initial audit does not justify changing six-shard parallelism or screenshot retention yet. Local git checkout is unavailable in this execution environment (DNS failure); source was retrieved through GitHub, and execution is delegated to repository CI. Keep PR #144 in draft until the remaining semantic review, final-head checks, after-change benchmark and acceptance criteria are satisfied.

## Second audit increment — consolidate equivalent setup and strengthen history protection

The prior exact-head PR CI run [45754520274](https://github.com/infoconex/analytics-dashboard/actions/runs/45754520274) passed five browser shards, but shard 6 (job 139690096532) stalled during Playwright Linux system dependency installation. The last progress at 04:21:35 UTC was Ubuntu index retrieval; the 25-minute job limit cancelled the job before Playwright discovery/execution. Required gate failed as designed; CodeQL 45754520311 passed. No assertion failure observed in this shard because it did not execute. Do not use this partial run as an after-change benchmark. APT network timeout hardening is a separate infrastructure concern; no CI changes in this audit increment.

| Removed standalone case or repeated assertion | Surviving assertion and boundary | Baseline median | Failure signal |
|---|---|---:|---|
| dashboard.spec.ts: tenant-isolated demo dashboard loads six visualizations | consumer.spec.ts: seeded dashboard renders six visualizations and consumers coordinate independent filters; exact same real default API, catalog navigation and seed, same exact title visibility and six .widget-tile count before any filter | 1.017s | Missing Revenue over time or wrong tile count fails the same assertion in surviving case. Original title overstated tenant isolation; actual isolation tests remain. |
| consumer.spec.ts: mobile filter controls do not overflow and remain operable | accessibility.spec.ts: mobile navigation, forms and active filters remain operable without page overflow; real API, same 390x844 viewport, mobile reload, Social chip, body width 390, editor button visibility. Existing Organic search and document width assertions unchanged. | 2.193s | Social selection, mobile reload, width, or edit-control regression fails the same assertion. Initial desktop-to-mobile resize no longer repeated here; readability and visual reflow cases retain resize behavior. |
| ux31Workflows.spec.ts: declined browser Back preserves unsaved editing draft | ux30Navigation.spec.ts: browser Back and Forward preserve return context and a declined dirty draft; same owner, scoped catalog-to-existing-dashboard route, metadata edit, history.back(), dismissal, exact unsaved input and current route, plus subsequent accept/back/forward/reload; now requires observed dismissal of actual dialog | 1.068s | Missing confirmation, discarded draft, or changed route fails. Smaller vs larger fictional catalog differs, but no size-dependent history logic or distinct assertion in retired case; residual fixture difference documented. |
| dashboardActivation.spec.ts: createEmpty helper asserts identical saved-empty text twice, consecutively | Keep first visibility assertion and every other helper assertion; no state change between the two reads | Not isolated | Missing saved-empty text still fails. |

All three removed browser cases had zero baseline PNG attachments. No screenshot evidence removed by these consolidations. Expected standing browser count: 218 (222 baseline minus four including initial obsolete zoom attempt). Sum of median durations for four removed cases is about 5.6 seconds across shards, before added assertions; not a wall-time saving estimate. These are source-equivalence comparisons, not executed fault injection. Viewer control tests intentionally retained: fresh viewer boot and owner-to-viewer reload exercise distinct role transitions. The UX-28 first-dashboard journey uses the real API and checks geometry, accessibility, saved state and an area chart; UX-31's mocked first-dashboard journey checks default visualization and exact create/update writes. Keep pending equivalence evidence rather than deleting based on similar titles. UX-35 preserves 18-card cross-source counts, exact values, scope messages, narrow iframe geometry and forced-colors focus; retain. Broad screenshot-only/evaluation-heavy scenarios remain because their implicit action failures, mock boundary, and manual evidence contract are not all independently mapped.

### Screenshot measurement (integrated baseline)

Byte-level SHA-256 comparison within each of the six integrated run 45490259682 archives: 734 PNG entries, 369 duplicate entries beyond the first identical PNG per archive. PNGs total 120,350,853 uncompressed bytes and 115,244,649 compressed entry bytes, of which 59,619,701 compressed bytes are duplicate copies. Typical duplicate is original output path plus Playwright attachment copy. This is measured storage duplication, not measured capture CPU or elapsed time. JSON reports do not include screenshot step duration. Successful screenshot capture remains unchanged; exclusion/deduplication could break named paths or JSON report attachments. Investigate separately with explicit evidence contract and measured time before changing retention. 

## Third audit increment — fix observed race and strengthen lower-layer assertions

CI run [45757794275](https://github.com/infoconex/analytics-dashboard/actions/runs/45757794275), attempt 1, on da54002: CodeQL passed; all six shards executed (five passed, one failed); gate correctly rejected failure. Downloaded shard 5 artifact 15088039778 and inspected Playwright trace and final DOM snapshot. The existing UX-39 failed-save/second-conflict test (baseline durations 1689/1586/1641 ms) timed out after 30s. Trace shows the recovery click at line 208 completed before the asynchronous dashboard GET returned; the test advanced its mock to revision 3 before recovery of revision 2 was complete. UI correctly reopened the review with revision 3, unchecked selection, original draft intact, Save disabled. Line 210 then waited ~28s for the disabled Save. The timing-dependent test is fixed by waiting for recovery to disappear and Save to become enabled before advancing the mock, preserving all intended assertions and adding explicit latest revision, disabled Save, revision sequence [1,1,2], local draft and remote description checks. UX-38 separately asserts revision changes during recovery, so both states remain covered. No timeout increase, retry configuration or production behavior changed. Rerun requested on prior head for diagnostic purposes only; the new head requires its own verification.

Frontend unit-test improvements: api.test.ts previously labeled a mock GET list 409 as a stale write; now actually calls dashboardApi.update and verifies the PUT endpoint, content type, draft and expectedRevision plus exact conflict status/message. The generic error semantics remain asserted. chartPresentation.test.ts previously compared Jan's color to itself (tautology); replace with known stable Jan/Feb/Dec colors, fallback, and twelve distinct month colors. Existing channel palette and real chart rendering tests remain. Both are improvements with unchanged test counts and no additional process startup. A broken revision payload, status handling or month mapping now fails at the pure client boundary. These static failure-signal checks are not executed mutation tests.

Authoring/visual group comparison: UX-18/19/20 plot keyboard tests cover distinct focus transitions, SVG Tab stops, Space/Enter, boundaries, selection and styling; retain. Pie vs donut and small vs large widget tests differ in labels, geometry, caps and scatter axes; retain alongside deterministic selected-label and fitting unit tests. Explore scatter mock evidence differs from real API save/reload and responsive screenshot geometry; retain pending a separate evidence workflow. UX-39 pending review vs UX-40 unsaved consumer preview vs UX-41 separate recipient browser context protect distinct publication boundaries, even when fixture actions overlap. Keep real-API dashboard activation separate from mock write accounting. UX-36 availability distinguishes unavailable/unsupported/no-match/503/403 and iframe resize; retain. No unique coverage removed in this increment.

## Final implementation evidence and disposition

The baseline source inventory is immutable historical evidence (including its original pending labels). The companion [capability disposition matrix](test-audit/decisions.md) supplies the final group-level decisions, with individual exceptions above. Do not treat the initial pending labels as current recommendations. All baseline test files are represented; parameterized cases are reconciled against the actual executed browser inventory. No further retirement is justified by the available evidence. The audit is a conservative source/behavior review, not exhaustive mutation testing or a claim that every retained test is minimal.

### Successful changed-head verification

PR head `abae9e8b96f0e97db5bfdb6f395bdd6f83730853`, [CI 45766146051](https://github.com/infoconex/analytics-dashboard/actions/runs/45766146051) and [CodeQL 45766146069](https://github.com/infoconex/analytics-dashboard/actions/runs/45766146069) passed. Frontend 195 tests across 26 files, TypeScript/Vite build, Compose smoke, planner/gate, six independent browser shards. Backend, live-provider and lab jobs were intentionally skipped by impact policy (unchanged source); full integrated verification still required after merge.

Downloaded all six revised archives (15092680286, 15092157384, 15092136888, 15092021875, 15091952585, 15091913251). Parsed JSON report, phase report and shard plan per archive: 39/39/30/37/33/40 tests, 218 distinct IDs; exactly one passed result per ID, each shard's actual IDs exactly match its selected IDs, consistent six-shard plan, zero unexpected/skipped/flaky. Baseline/current diff: 5 absent IDs and 1 new ID, accounting for the four removed cases plus renamed consumer case. No other browser case disappeared. Same 29 test files. The prior failure in UX-39 passed after synchronization; all consolidation survivors passed. No changes to production, CI policy, dependencies, provider, backend or lab test code. No new retries.

| Metric | Integrated baseline 45490259682 | Final PR implementation 45766146051 |
|---|---:|---:|
| Browser tests | 222 | 218 |
| Frontend tests | 195 | 195 |
| Backend tests | 180 | unchanged, skipped |
| Live provider tests | 22 | unchanged, skipped |
| Lab guards | 20 | unchanged, skipped |
| Sum individual browser test durations | 601.459 s | 563.305 s |
| Sum Playwright including server startup | 649.432 s | 615.376 s |
| Sum API restore | 95.037 s | 74.785 s |
| Sum API build | 61.932 s | 51.464 s |
| Sum npm ci | 25.336 s | 22.075 s |
| Sum Linux dependency preparation | 136.429 s | 131.514 s |
| Sum Chromium preparation | 3.632 s | 3.365 s |
| Sum browser job elapsed intervals | 1162 s | 1107 s |
| Longest browser job | 219 s | 208 s |
| CI run start to completion | 238 s | 255 s |
| PNG archive entries | 734 | 734 |
| Byte-identical duplicate PNG entries (within archive) | 369 | 369 |
| Compressed duplicate PNG bytes | 59,619,701 | 59,614,439 |
| Total six ZIP archive bytes | 115,722,072 | 116,005,120 |

The 38.154s (6.34%) aggregate case-time improvement versus integrated baseline and 55s (4.73%) aggregate browser job improvement are observations, not demonstrated causal savings. Baseline range was 566.049–608.879s, and the latest result is 2.744s below the fastest observation. The PR workflow was 17s slower and had 30s from workflow start to planning job start. It ran fewer suites because of impact policy; do not compare aggregate full-runner use across non-equivalent jobs. Use post-merge full run for like-for-like CI consumption. No significant execution-speed improvement established. Keep six duration-balanced shards and current weights; change count is minor, no evidence for changing parallelism. Case-level timing comparison CSV was delivered to the owner; artifact IDs and the per-file table below permit independent reconciliation. Artifact retention is finite; this document preserves key numbers. Detailed durations for non-browser individual tests were not available in the observed reports.

### Per-file browser case execution totals (seconds; counts from actual reports)

| File | Before cases | After cases | 45490259682 | 45489439513 | 45416624860 | 45766146051 |
|---|---:|---:|---:|---:|---:|---:|
| accessibility.spec.ts | 7 | 7 | 10.87 | 9.46 | 13.75 | 10.55 |
| consumer.spec.ts | 7 | 6 | 15.24 | 13.97 | 13.60 | 13.08 |
| customerTasks.spec.ts | 11 | 11 | 31.77 | 28.53 | 21.50 | 25.59 |
| dashboard.spec.ts | 10 | 9 | 17.67 | 16.88 | 16.98 | 16.23 |
| dashboardActivation.spec.ts | 4 | 4 | 18.05 | 16.62 | 17.65 | 17.28 |
| discovery.spec.ts | 13 | 13 | 17.95 | 17.91 | 21.42 | 19.09 |
| embed.spec.ts | 8 | 8 | 19.21 | 17.41 | 17.54 | 19.19 |
| exp02Calendar.spec.ts | 1 | 1 | 3.16 | 3.05 | 3.07 | 3.01 |
| explore.spec.ts | 6 | 6 | 8.15 | 7.27 | 10.26 | 8.09 |
| handoff.spec.ts | 8 | 8 | 22.53 | 18.68 | 14.35 | 17.50 |
| interpretation.spec.ts | 7 | 7 | 14.53 | 13.15 | 13.47 | 13.36 |
| organization.spec.ts | 8 | 8 | 9.64 | 9.84 | 11.57 | 7.22 |
| readability.spec.ts | 7 | 7 | 10.80 | 10.10 | 11.16 | 11.15 |
| ux29Discovery.spec.ts | 2 | 2 | 7.06 | 7.66 | 8.65 | 6.86 |
| ux30Navigation.spec.ts | 5 | 5 | 10.93 | 10.87 | 10.81 | 12.02 |
| ux31Workflows.spec.ts | 12 | 11 | 29.32 | 28.15 | 28.10 | 28.68 |
| ux32EmbedNavigation.spec.ts | 5 | 5 | 16.36 | 14.55 | 10.58 | 11.42 |
| ux33EmbedContinuity.spec.ts | 4 | 4 | 26.25 | 22.74 | 16.75 | 21.17 |
| ux34DenseWayfinding.spec.ts | 2 | 2 | 25.47 | 22.07 | 23.26 | 23.46 |
| ux35FilterScope.spec.ts | 2 | 2 | 19.95 | 19.22 | 19.10 | 21.10 |
| ux36Availability.spec.ts | 4 | 4 | 21.28 | 18.81 | 14.15 | 17.59 |
| ux37Repair.spec.ts | 6 | 6 | 19.94 | 20.55 | 24.26 | 17.40 |
| ux38ConflictRecovery.spec.ts | 7 | 7 | 15.55 | 14.73 | 20.24 | 15.95 |
| ux39SaveReview.spec.ts | 12 | 12 | 22.28 | 19.74 | 20.74 | 20.64 |
| ux40DraftPreview.spec.ts | 12 | 12 | 19.79 | 19.14 | 19.24 | 19.96 |
| ux41SavedHandoff.spec.ts | 8 | 8 | 22.54 | 21.34 | 21.80 | 22.05 |
| visual.spec.ts | 21 | 20 | 72.31 | 66.28 | 100.66 | 75.57 |
| visualizationAuthoring.spec.ts | 7 | 7 | 20.29 | 19.20 | 19.61 | 19.90 |
| visualizationReuse.spec.ts | 16 | 16 | 52.58 | 58.12 | 64.59 | 48.20 |

### Coverage and remaining risk

The exact-head success establishes execution, not fault-injection equivalence. Reused exact assertions and the old zoom probe's three observed false-achievement reports establish source-level failure-signal comparisons; the UX-39 trace is observed evidence of a synchronization race. Temporary production defects were not injected: private repository checkout unavailable (DNS) in audit environment, and committing deliberately broken source to trigger CI would violate the no-temporary-defect-commit requirement. Do not describe this as executed mutation testing. Mobile consolidation no longer repeats the exact desktop-start/resize-before-reload path; existing visual reflow tests retain viewport resizing and the surviving mobile case retains actual reload, selection, overflow, chip and editor checks. All other consolidated assertions retained. No backend/provider security reduction. Maintainability gain: four fewer browser scenarios, shared setup, less repeated assertion work; two strengthened deterministic contracts, one observed race resolved. No measured significant speedup; do not force reductions.

Follow-ups created rather than expanding this PR: [#145](https://github.com/infoconex/analytics-dashboard/issues/145) bounded package-index stalls; [#146](https://github.com/infoconex/analytics-dashboard/issues/146) separate evaluation evidence/measure and deduplicate artifacts safely. Both remain unimplemented. The optional `npm run visual:evidence` and `npm run visual:ui-only` commands still select visual.spec.ts; the latter runs mock-only Vite, without .NET. Keep their evidence contract and distinguish historical evaluation from standing assertions. EXP-03 remains out of scope; coordinate next issue with owner.

Final documentation commit requires exact-head verification, PR review and squash merge into experiment/dashboard-filtering only. Record final integrated SHA, all post-merge checks and comparable full CI timing in issue #142 before closing. Main must stay unchanged.
