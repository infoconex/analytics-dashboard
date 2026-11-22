# CI-1 — Faster build and browser verification

## Baseline and intent

At UX-31 main commit `31df4bc4880c57df25ad1314135a19511ae9f721`, Verify [run 44977901674](https://github.com/infoconex/analytics-dashboard/actions/runs/44977901674) completed in approximately **6m 42s**. Its single Playwright worker completed **159 passing browser tests in 5m 12s**; the successful real-provider job took approximately 1m 22s, and CodeQL completed in approximately 2m 17s. This is a baseline, not a guaranteed optimization target.

## Pipeline design

- **Core .NET, web and lab**: existing `./scripts/verify.ps1`, without `-IncludeBrowserTests`. Preserves normal solution restore, 145 .NET tests, 132 Vitest tests, frontend typecheck/build, and the fictional UX13/UX14 lab checks.
- **Browser E2E**: four independent Linux runner jobs, each restoring/building the API, installing web dependencies, and running a disjoint `--shard=1/4`, `--shard=2/4`, `--shard=3/4`, or `--shard=4/4` of the full suite. All four jobs must succeed. Each runner has its own API, Vite instance, browser and randomized temporary SQLite catalog; no shared mutable backend. One worker per runner is preserved to avoid introducing within-runner concurrency hazards.
- **Provider conformance**: unchanged mandatory SQL Server and PostgreSQL integration job, with its isolated ephemeral credentials/containers.
- **CodeQL**: both language analyses remain mandatory on pull requests, main pushes and weekly scheduled scans.
- **PR concurrency**: newer PR commits supersede obsolete Verify and CodeQL runs, but pushes to main and scheduled scans are not canceled.
- **Caching**: npm cache remains; NuGet and Playwright Chromium caches are keyed to project manifests / locked web dependencies. The Chromium install step still checks Linux dependencies, including on cache hits.
- **Evidence**: each browser shard uploads all passing screenshot/JSON attachments and retains videos/traces for failures instead of capturing videos/traces for every successful test on CI. Shards use distinct artifact names to prevent collisions. Local full-recording development behavior for explicitly recorded suites remains available.

### Local reproduction

Run all the original checks, including the whole browser suite:

```powershell
./scripts/verify.ps1 -IncludeBrowserTests
```

Run a single browser shard after its API/dependency preparation:

```powershell
./scripts/verify-browser.ps1 -ShardIndex 1 -ShardTotal 4
./scripts/verify-browser.ps1 -ShardIndex 2 -ShardTotal 2
```

Or run only the non-browser checks:

```powershell
./scripts/verify.ps1
```

The independent shard script expects a local Playwright Chromium installation outside CI (the CI script installs Chromium/system dependencies automatically). Its `--no-build` web server uses the API project built by that same script.

## Verification, timing and guardrails

Compare **end-to-end wall time from GitHub Actions workflow creation to completion**, not just the sum of parallel job durations. On the completed PR and post-merge runs, record core, all four browser shards, provider and CodeQL conclusions as well as browser test counts. Sharding may be uneven because Playwright preserves test-file grouping by default; keep `workers: 1` and avoid `fullyParallel` until test independence has been audited. All browser suites remain enabled; no test is selected out by directory or tag.

This is CI workflow optimization, not an authorization, production-security, application logic, deployment, or test-coverage change.

## Initial PR benchmark and tuning

The first CI-1 PR run [Verify 44987306882](https://github.com/infoconex/analytics-dashboard/actions/runs/44987306882) passed all 159 browser tests with two independent shards. The workflow took **5m 56s**, only **46 seconds faster** than the baseline, because shard 1 completed 81 tests in 2.6 minutes while shard 2 took 4.9 minutes for 78 tests. Both CodeQL language jobs, .NET/web/lab and provider tests passed. The first attempt demonstrated that equal test counts do not guarantee balanced execution time. Four independent shards aim to reduce the longest file-group workload without enabling concurrent use of mutable API state in the same runner. This adds runner startup/build overhead and should be re-evaluated based on measured overall wall time and available GitHub Actions capacity.
