# CI browser critical path — measurement and weekly cache reuse

Issue #141. Experimental integration branch only.

## Baseline

Integrated warm verification [run 45338861007 attempt 2](https://github.com/infoconex/analytics-dashboard/actions/runs/45338861007/attempts/2), commit bcafef6cf26375bbf73a9c7681b2b2d34e0aaaa8: 5m35s wall time, 222 browser tests; all four shards restored 13 APT archives and downloaded zero archive bytes. Runner-log spans: 242/225/291/308 seconds; Playwright reported 1.9/2.5/3.4/3.9 minutes. The four browser jobs consumed roughly 17m46s of runner time, excluding other jobs. Original baseline: 7m57s. No coverage reductions.

## Measurement change

- Exact weekly APT key is still preferred. Prefix fallback is limited to cache format, Ubuntu 24.04, runner architecture and lockfile hash. APT still updates signed indexes and downloads required current archives. The existing single writer saves the current-week key on a non-exact hit.
- The hosted wrapper records .NET restore/build, npm install, Linux dependencies, Chromium preparation and complete Playwright invocation in a versioned JSON artifact. Split Playwright's dependency installer and browser installer on hosted Linux; retain the existing behavior elsewhere. The Linux dependency phase includes both index refresh and package installation; their boundaries remain visible in timestamped APT logs.
- Retain the dot reporter and add Playwright JSON with individual test/result durations and start times. Phase start to first test start is a startup/collection/worker proxy, not a pure web-server timer. Preserve one worker, independent API/catalog, initial native four-way sharding and existing failure evidence.
- Use workflow attempt and job step timestamps to compare runner initialization, cache restore, evidence upload, wall time, and aggregate job seconds. Compare multiple successful runs because runner variance is substantial.

## Next evaluation

Use the JSON evidence to compare deterministic whole-file duration balancing with existing native sharding. Retain the full discovered test inventory exactly once, including new files; do not introduce selective test execution or a shared mutable API. Compare four/six/eight runners only where predicted wall-time benefit justifies added startup cost. Audit regression effectiveness separately in #142. No registry, shared build artifacts, or test removals introduced by this measurement change.

## Measured file balancing

Exact-head instrumentation run [45341528564](https://github.com/infoconex/analytics-dashboard/actions/runs/45341528564) passed all 222 tests across 29 unique files, with no skipped, unexpected or flaky results. Wall time 5m26s. The four reports contain 103805/145599/171098/149724 ms of summed individual test results, respectively. The checked-in timing snapshot is derived from those reports (one observation, not a guarantee).

Whole-file longest-processing-time-first estimates for 4 shards: 143569/141804/142426/142427 ms; 6 shards: maximum 99120 ms; 8 shards: maximum 73065 ms. Four-shard balancing reduces the longest measured test workload by 16.1%, without adding repeated dependency preparation or API instances. Additional runners would repeat the setup costs (Linux dependencies alone varied 13–72 seconds); benchmark four first, defer increasing runner count pending actual wall time and runner consumption. No test is removed.

Hosted CI discovers all tests using Playwright --list, assigns each file deterministically using historical per-test durations and a median fallback for new files, runs exact anchored file filters and verifies actual executed test IDs and successful single executions against discovery. Every shard records the full plan. Local scripts still use Playwright native sharding. Unit tests cover new/renamed files, changed counts, deterministic ties, duplicates and exact execution checks. The plan is a performance hint, not an allowlist.

A temporary PR-only next-week key probe will validate a non-exact APT cache restoration and single-writer refresh. Revert the probe to the actual UTC week before final verification and merge.

## Verified four-shard benchmark and rollover

Run [45342665521](https://github.com/infoconex/analytics-dashboard/actions/runs/45342665521) and CodeQL 45342665586 passed at eedc2ecc5f16bd001cac797e9ee92d2c35f04409. Wall time 4m56s versus 5m26s for instrumentation and 5m35s integrated warm baseline. 45/53/60/64 = 222 tests passed; each shard verified its exact selected IDs and single executions. Browser phase seconds 144.491/186.105/172.305/152.272; Linux dependency phase 77.068/12.981/11.992/59.725. Approximate browser runner-log consumption 17m37s. The simulated W49 primary key restored W48 archives on all four shards (13 each, zero archive downloads); only shard 1 saved W49. The probe is now removed and actual UTC week restored.

Since 4m56s remains above the 3–4 minute target, benchmark six isolated shards using the same planner and test inventory. Compare wall time and aggregate runner time; do not retain extra runners automatically. Eight remains a modeled alternative unless the measured six-shard result warrants further evaluation. No application or regression case changes.
