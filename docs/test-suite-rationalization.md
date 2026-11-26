# Regression effectiveness audit

Status: **in progress** (issue #142). This document records verified findings, not completion of the acceptance criteria. The source baseline is `09a623eed301c12c112b1a5be056143de7a18781` on experiment/dashboard-filtering; main is `4ef243a60748a694afd6e52e192dc273e99565fb`. No product changes are authorized.

## Method and baseline

Review actual assertions and exercised boundaries, then compare coverage across layers. Default to retaining cases unless the equivalent failure signal is established. A title, repeated assertion, or execution cost alone is insufficient evidence of duplication. Record source references, replacement assertions, timing variability and residual risk. Distinguish a standing regression test from scripted evaluation evidence. Do not weaken required CI, security, provider or accessibility checks.

Integrated run [45490259682](https://github.com/infoconex/analytics-dashboard/actions/runs/45490259682) passed in 238 seconds. CodeQL run 45490259648 passed. Measured baseline counts from job logs: 222 browser tests in 29 files; 195 frontend tests in 26 files; 180 backend tests; 19 relational/MySQL provider cases and 3 Elasticsearch cases in provider job (22 total; not assumed disjoint from backend without inspecting filters); 20 lab guards; 18 Python impact/cache orchestration tests in planning; Compose integration passed. Browser planner test count requires separate reconciliation. Sum of CI job start-to-completion intervals was 1,384 seconds (23m04s), of which six browser jobs consumed 1,161 seconds (19m21s); this is elapsed job time, not billed minutes.

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
| consumer.spec.ts: navigation reset | Back/reopen and reload reset filters | Keep: standalone navigation intentionally differs from host persistence; title claims no saved mutation but does not directly inspect mutation requests or persisted revision, improvement candidate |
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

## Remaining work and architecture guidance

Keep tests at lowest appropriate layer; preserve actual real browser behavior and deployed boundaries. New regression scenarios should identify the failure they protect and consult existing assertions, extend an existing case when safe, avoid coupling mutable fixtures, and use accessible selectors. Keep manual comparison and evaluation-only probes separate from required regression verification. Successful screenshots are diagnostic evidence, not automatically an assertion; preserve unique visual evidence and investigate collection overhead separately. Do not assume fixed timeout ceilings are waits.

Remaining: complete source-case inventory for all standing layers; review visualization and authoring groups against deterministic logic, API/provider, Compose, lab and gate tests; measure screenshot overhead and repeated setup; assess coverage gaps; refresh timing only if justified; verify final head, compare after timing and runner consumption, review diff and verify post-merge before closing issue. No parallelism, production behavior or CI gate change in this initial increment. No EXP-03 work.
