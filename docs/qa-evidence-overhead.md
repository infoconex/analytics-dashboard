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

Aggregate runner time, per-phase capture/copy/archive/upload durations, artifact bytes, and reference integrity are compared against successful #142 run 45766146051 once the exact-head CI run completes. Historical runs did not separately time screenshot capture, attachment copying, or report archiving, so those phase baselines are recorded as unavailable rather than inferred.
