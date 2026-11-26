# Browser QA evidence cost and duplicate handling

This investigation follows #146 on `experiment/dashboard-filtering`. It keeps the browser suite, required assertions, and evidence commands intact.

## Baseline

The #142 audit measured run [45490259682](https://github.com/infoconex/analytics-dashboard/actions/runs/45490259682) and successful rerun [45766146051](https://github.com/infoconex/analytics-dashboard/actions/runs/45766146051). Each contained 734 PNG entries. Hash comparison found 369 byte-identical duplicate entries (59,619,701 compressed bytes in run 45490259682), usually one named test output plus its Playwright attachment copy. The existing Playwright timing report has case durations and runner setup phases, but does not separate screenshot capture from `testInfo.attach` file copying. Existing run archives therefore cannot supply a retrospective capture/copy timing baseline.

## Evidence contract retained

- `visual.spec.ts` keeps its broad deterministic desktop, mobile, tablet, 320px reflow, and forced-colors journeys and all interaction/actionability assertions.
- Browser-native 200% and 400% zoom remains an asserted Chromium tab-zoom test; viewport emulation and CSS scaling do not substitute for it.
- Geometry, document overflow, focus visibility/recovery, axe scans, exact data, chart interaction, keyboard journeys, real API/integration cases, and failure video/trace evidence remain required.
- Named screenshot attachments and JSON inventories remain available in CI artifacts. `npm run visual:evidence` and `npm run visual:ui-only` are unchanged; their local output keeps named source screenshots as before.
- The browser job still uses an isolated API database per run and `reuseExistingServer: false`. No mutable service, shared API artifact, or cross-run server reuse is introduced.

## Measurement and reduction

`visual.spec.ts` now records `screenshot-capture` and `attachment-copy` elapsed milliseconds per named capture in a Playwright JSON attachment. These cover the broad visual capture helper and include screenshot file writing in capture time. Other Playwright-produced video, trace, and failure artifacts are not changed.

Before archiving in CI, `scripts/ci/dedupe-browser-evidence.mjs` hashes PNGs and removes an output-path PNG only when identical bytes are present under an `attachments/` directory. It checks JSON report path references before and after pruning and writes `browser-evidence-deduplication.json` with the number and bytes removed. Its default mode is dry-run; only the CI workflow passes `--apply`. Unattached or non-identical screenshots are kept. Referenced Playwright attachments are never removed.

`scripts/ci/archive-browser-evidence.py` creates a lossless per-shard ZIP rooted at `web/test-results/` and measures report-archive duration, source bytes, and archive bytes. The upload-artifact action then uploads that archive with compression level 0 plus its small metrics JSON, so its job-step duration is the separate upload phase (including the action's minimal wrapper bookkeeping). The standard GitHub artifact download is a ZIP containing the measured ZIP; extract both layers to recover the original `web/test-results/` paths. For example: `unzip browser-evidence-shard-1.zip -d artifact && unzip artifact/browser-evidence-shard-1.zip -d evidence`. Playwright JSON attachment paths remain resolvable under `evidence/web/test-results/`.

## Before and after

Comparison uses successful #142 run [45766146051](https://github.com/infoconex/analytics-dashboard/actions/runs/45766146051) and exact-head run [45886091161](https://github.com/infoconex/analytics-dashboard/actions/runs/45886091161). Artifact totals come from GitHub's artifact metadata. Workflow and aggregate job durations come from the Actions run/job timestamps. Browser setup and Playwright phase durations are sums of the existing per-shard CI timing records. Upload durations are GitHub's rounded step durations; archive duration is the measured ZIP creation time. This is a one-run comparison, not a claim of stable performance under repeated load.

| Measure | Before | After | Change |
|---|---:|---:|---:|
| Full workflow wall time | 255 s | 236 s | −19 s (−7.5%) |
| Aggregate runner time, all jobs | 1,165 s | 1,293 s | +128 s (+11.0%) |
| Aggregate browser job time | 1,107 s | 1,029 s | −78 s (−7.0%) |
| Browser API/dependency setup phase sum | 283.19 s | 238.40 s | −44.79 s (−15.8%) |
| Playwright plus server startup phase sum | 615.38 s | 646.22 s | +30.84 s (+5.0%) |
| Browser artifact size, all six shards | 116,005,120 bytes | 58,886,624 bytes | −57,118,496 bytes (−49.2%) |
| Artifact upload action step sum | 15 s | 9 s | −6 s (−40%); before included archive creation |

The after-run screenshot capture sum was 21,799 ms and attachment-copy sum was 75 ms. The six report ZIPs took 1,607.70 ms total to create; their combined source size after deduplication was 64,351,555 bytes. The deduplication manifest removed 361 identical PNG source copies totaling 59,248,502 bytes and retained 373 PNG entries. All 413 Playwright report attachment references were present after pruning. Exact artifact size reduction includes the measured inner ZIPs and the outer GitHub artifact wrapper.

Historical run reports do not contain screenshot-capture, attachment-copy, or pre-upload archive timings; those before values are unavailable, not inferred. The full workflow wall time and browser job aggregate improved in this pair, while total aggregate runner time and Playwright execution time increased. Non-browser job variance and this one-run sample prevent attributing either runtime movement to screenshot deduplication.

## Historical and manual comparison review

The explicit assertion audit in `docs/test-audit/decisions.md` and `docs/test-suite-rationalization.md` retains the visual journeys for actionability, geometry, focus, accessibility, exact data, and native zoom. No test, assertion, viewport, screenshot state, or historical manual evidence was removed. `scripts/ci/verify-product-comparison.sh` still runs the isolated UX-13 and UX-14 evidence phases sequentially, retains original source PNGs separately from review derivatives, and builds `ux14-review-package.zip`. `.github/workflows/evaluation-comparison.yml` remains manual-only and uploads the UX-13/UX-14 originals, manifest, checksums, and review package without this CI-only deduplication. Its 14-day artifact retention and durable-copy requirement are unchanged.
