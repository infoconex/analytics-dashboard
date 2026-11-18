# UX-14 — Matched customer task paths and visual comparison evidence

**Tracking:** [Issue #54](https://github.com/infoconex/analytics-dashboard/issues/54); baseline UX-13 main `c241bbd68fa8b4fa10843509c902ba78d7a2e056`. **This is synthetic scripted browser evidence, not participant research, real AT validation, a WCAG audit or a comparative superiority study.** R0 remains unapproved.

## 1. Predeclared parity criteria

The UX-13 source fixture, precise 9.5.6 images, internal Docker network, isolated role and read-only Kibana permissions remain immutable. Both surfaces use 12 matching fictional panel titles, eleven monthly commerce panels and one marketing channel panel. *No calendar year, artificial observation timestamps, cross-index join, unique-customer sum or derived conversion ratio* is permitted. Sources are separately verified against the original literal arrays in `web/src/demoData.ts`.

Only **T02** is a provisional scripted comparison candidate: independently create an authorized read-only browser context for each product, enter its saved-dashboard **catalog** with default filters, select “Business performance” through the visible UI, and verify the corresponding revenue visualization in the saved report. The catalog start is a deliberate narrower variation of UX-12's general organization landing page; researchers must treat that deviation explicitly. Matching title, screenshot or successful UI click **does not** establish independent human discoverability, equal cognitive effort, semantic parity across all tasks, or study R1 approval.

Every other task is unapproved for paired scoring until its separate requirements have been demonstrated in the actual browser. T10A, T10B, T11, T12 and T13 are expressly excluded: controlled missing/unavailable fixtures, tenant security and read-only embedding have no approved matched Kibana counterpart. T11 remains a **separate synthetic security probe**, not a usability score. Kibana Spaces are not Analytics Dashboard's server-enforced organization isolation.

| Task | Deterministic start / test | Decision and unresolved proof |
| --- | --- | --- |
| T01 | Fresh authorized viewer | **Unapproved:** Kibana Space/role, fictitious provenance and Analytics organization context are not interchangeable or visibly equivalent |
| T02 | Fresh saved-dashboard catalog, unfiltered | **Conditional scripted candidate only:** must prove independent catalog-to-revenue paths, fixed sources and read-only roles in both; R1 still pending |
| T03 | Both full Jan–Dec charts | **Unapproved:** Kibana chart does not visibly present the same caveat/units/provenance; “Last 15 minutes” can mislead about undated data |
| T04 | Fresh saved revenue report | **Unapproved:** must inspect the source's exact October row in Kibana UI, not infer $41,400 from plotted line height or admin API |
| T05 | Fresh default filters | **Unapproved:** independent commerce Oct–Dec and Direct-only channel controls require actually demonstrated UI scopes |
| T06 | T05 proven state | **Unapproved:** selectively remove only month scope while retaining Direct |
| T07 | T06 proven state | **Unapproved:** restore all 12+5 records, without modifying saved objects |
| T08 | Dense saved 12-panel view | **Unapproved:** equivalent numbered finding and focused return path not demonstrated in Kibana |
| T09 | Saved view, no temporary filter | **Unapproved:** link, permissions, snapshot and transient filter persistence differ or remain unverified |
| T10A | Controlled missing resource | **Excluded:** no comparable Kibana missing-resource configuration |
| T10B | Controlled dashboard-list 503 | **Excluded:** no comparable controlled Kibana outage/retry configuration |
| T11 | Unauthorized fictional destination | **Excluded from usability:** isolated index/view denials tested separately; no tenant-model equivalence |
| T12 | Different authorized organization | **Excluded:** Kibana Space change is not a tenant switch |
| T13 | Same-origin fictional read-only iframe | **Excluded:** no equivalent approved Kibana host or embedding contract |

## 2. Reproducible operator steps

The [UX-14 comparison workflow](../.github/workflows/ux14-comparison.yml) performs these steps on a disposable GitHub-hosted Linux runner. Docker Engine 28+, Compose, Node 24, OpenSSL, enough Elastic memory, and Playwright Chromium are required. A missing runtime is an **environment/setup defect**, never a product result.

```bash
npm --prefix web ci --no-audit --no-fund
npm --prefix web run test:lab
bash lab/ux13/lab.sh up
bash lab/ux13/lab.sh verify
cd web && npx playwright install --with-deps chromium
# Start a local Vite server bound to 127.0.0.1:5173 in a separate terminal.
# In a disposable, credential-safe shell only:
set -a; source ../lab/ux13/secrets.env; set +a
node scripts/ux14/browser-evidence.mjs
# Return to repository root; tear down only the named local lab:
bash lab/ux13/lab.sh down
```

The separate browser runner never logs or archives passwords, request Authorization headers, browser HAR, cookies or participant data. Its Analytics HTTP fixture intercepts only read-only GETs; write requests are refused. Both products' external browser requests are denied. `lab/ux13/lab.sh` rejects arbitrary hosts and unexpected cluster/version, verifies every imported record, and checks negative authorization and proxy network isolation. The path runner creates a **fresh context per product and display condition**; T05–T07 deliberately share one Analytics state because they are dependent tasks. `T10A`, `T10B` and `T13` use isolated Analytics-only synthetic states. No live data source or production embedding is activated.

The captured display matrix is 1440×900, 390×844, 320×900, forced colors, and genuine Chromium `chrome.tabs.setZoom(2/4)` in extension-backed persistent contexts. Browser zoom reports native factor, actual CSS viewport, DPR and document width, rather than treating CSS scaling or Playwright `deviceScaleFactor` as zoom. The 200%/400% window usable area may differ from the nominal browser window size; the actual measurements are authoritative. A single initial Tab or a screenshot does not establish full keyboard or assistive-technology operability.

## 3. Evidence integrity, package and inspection

The workflow uploads `ux14-fictional-comparison` with **original unmodified PNGs** under `lab/ux14/evidence/raw/`, path attempts and actual browser measurements in `manifest.json`, the checked-in source fixture manifest, a copy of actual UX-13 environment evidence, and per-file SHA-256 checksums. Its `ux14-review-package.zip` contains the same assets and machine-readable limitations. The workflow artifact is retained for **14 days only**: it must be explicitly copied into durable project evidence storage before expiration. CI artifact retention alone does **not** satisfy the permanent delivery gate. Do not commit the disposable passwords or any participant information.

Only if **both T02 browser paths reach the report from their own catalog** does the runner generate labeled side-by-side review sheets (`review-T02-*.png`). Sheets are layout/scaling derivatives for convenience; open the corresponding `raw/` images for the original pixels, focus states and exact zoom. A failed path produces an `incomplete` PNG and an unapproved decision, never a fake paired result. The manifest differentiates actual PR head from GitHub's synthetic PR-test-merge checkout and includes the GitHub run ID.

Reviewers must open **both original desktop and native zoom PNGs**, mobile and forced-colors captures, not simply trust Playwright or axe passing. Inspect chart content, data labels, scroll/reflow, sticky chrome occlusion, focus outlines, keyboard transitions, failed navigation and browser errors. The `sourceFixtureSha256` must equal the UX-13 fixture SHA and all `checksums` must match the archive contents. Compare permission and sealed environment logs separately. No screenshot is a human outcome.

## 4. Finding classes and research boundary

- **Product defect:** requires independently reproduced incorrect product behavior, an original browser artifact and a regression test before a low-risk change. Never infer a defect from a different product design alone.
- **Environment/setup defect:** Docker/network/browser/product version mismatch, fixture drift or unavailable local runtime. Do not attribute to either UI.
- **Test-script defect:** stale selector, false wait/readiness signal or simulated action not genuinely performed through the UI; stop claiming parity until corrected.
- **Task-parity limitation:** one product cannot meet the same start, source-row, filter, persistence or security semantics under the approved scope. Exclude from comparative scoring.
- **Human-research hypothesis:** an untested concern about orientation, chart interpretation, trust, discovery or task effort. No synthetic user or timed human metrics may be fabricated.

Remaining gates: **R0** research owner/consent/retention/recording approval; **R1** completed *independent per-task* parity and researcher sign-off; **R2** 8–12 real counterbalanced consented participants; **R3** independently observed real AT speech/navigation; **R4** full manual WCAG 2.2 AA scope and audit; **R5** separate production security and integration approval. **All remain unpassed.** Neither this scripted capture nor a successful CI report supplies superiority, usability validation, customer-tenant security equivalence or WCAG conformance.

## 5. Actual run ledger

Populate only after successful hosted execution, direct inspection of original screenshots and sealed package retention. Preserve the run ID, exact PR head, browser build, observed focus/viewport/DPR and any exclusion changes. Do not prelabel T02 as a human-scoring-approved pair.
