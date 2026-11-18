# UX-14 — Matched customer task paths and visual comparison evidence

**Tracking:** [Issue #54](https://github.com/infoconex/analytics-dashboard/issues/54); baseline UX-13 main `c241bbd68fa8b4fa10843509c902ba78d7a2e056`. **This is synthetic scripted browser evidence, not participant research, real AT validation, a WCAG audit or a comparative superiority study.** R0 remains unapproved.

## 1. Predeclared parity criteria

The UX-13 source fixture, precise 9.5.6 images, internal Docker network, isolated role and read-only Kibana permissions remain immutable. Both surfaces use 12 matching fictional panel titles, eleven monthly commerce panels and one marketing channel panel. *No calendar year, artificial observation timestamps, cross-index join, unique-customer sum or derived conversion ratio* is permitted. Sources are separately verified against the original literal arrays in `web/src/demoData.ts`.

Only **T02** is a conditional scripted comparison pair: independently create an authorized read-only browser context for each product, enter its saved-dashboard **catalog** with default filters, select “Business performance” through the visible UI, and verify the corresponding revenue visualization in the saved report. This path passed in the hosted UX-14 run, but the catalog start is a deliberate narrower variation of UX-12's general organization landing page; researchers must treat that deviation explicitly. Matching title, screenshot or successful UI click **does not** establish independent human discoverability, equal cognitive effort, semantic parity across all tasks, or study R1 approval.

Every other task is unapproved for paired scoring until its separate requirements have been demonstrated in the actual browser. T10A, T10B, T11, T12 and T13 are expressly excluded: controlled missing/unavailable fixtures, tenant security and read-only embedding have no approved matched Kibana counterpart. T11 remains a **separate synthetic security probe**, not a usability score. Kibana Spaces are not Analytics Dashboard's server-enforced organization isolation.

| Task | Deterministic start / test | Decision and unresolved proof |
| --- | --- | --- |
| T01 | Fresh authorized viewer | **Unapproved:** Kibana Space/role, fictitious provenance and Analytics organization context are not interchangeable or visibly equivalent |
| T02 | Fresh saved-dashboard catalog, unfiltered | **Scripted path verified in both:** fixed fictional source and read-only role; *the original UX-12 organization-landing-page task remains unapproved*, R1 pending |
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

The captured display matrix is 1440×900, 390×844, 320×900, forced colors, and genuine Chromium `chrome.tabs.setZoom(2/4)` in extension-backed persistent contexts. Browser zoom reports native factor, actual CSS viewport, DPR and document width, rather than treating CSS scaling or Playwright `deviceScaleFactor` as zoom. At 200%/400%, retain both independent Playwright PNGs and DevTools `Page.captureScreenshot` PNGs for the scrolled chart target: they exposed a compositor/capture disagreement, so raw pixels and page geometry must be evaluated together. The 200%/400% window usable area may differ from the nominal browser window size; the actual measurements are authoritative. A single initial Tab or a screenshot does not establish full keyboard or assistive-technology operability.

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

Hosted **scripted comparison**: [UX-14 run #44348625600](https://github.com/infoconex/analytics-dashboard/actions/runs/44348625600), PR #55 head `9028daa2fb336ccbe1265c2d685a87478d74ed5e` (the GitHub runner checked out the synthetic PR test-merge `5b5ebc2e1118c0efb1e8c394c1459a72b80c422c`). The signed-in ephemeral viewer reached the saved revenue dashboard by clicking it from each product's own catalog at desktop, mobile, narrow, and forced-colors sizes. This is the *narrowed scripted T02 variant only*; **zero human pairs approved**. It yielded **43 original PNGs, 6 labeled T02 review sheets, 45 SHA-256-checked files, 0 checksum failures**. The downloadable package includes the original pixels, all browser observations, the source and environment manifests, and the review sheets. The 14-day [CI artifact](https://github.com/infoconex/analytics-dashboard/actions/runs/44348625600) is not durable storage; an independently retained copy is required. Re-run the workflow to obtain measurements attached to any later PR head.

Environment: Linux x64, kernel `7.0.0-1019-azure`; Node `24.22.2`; Docker `29.4.2`; Compose `5.1.3`; Playwright Chromium `159.0.8154.6`. Elasticsearch and Kibana both report `9.5.6`, pinned respectively to `sha256:79b4f1de4c15e6eca824723086a51e5934406d614d410cc11be77748cafac537` and `sha256:c7ed45da5c3cfea020fc6c99ce027f4d21d19dab330379c5115d5eb95f6ecebc`. The UX-13 source fixture hash is `7f1d3338cab3b4733bd655e7c9271199ee729f4a53fc3b251b834fa91f19cf8b`; all 12 fictional panels and their verified source data stayed unchanged. The proxy remains loopback-only, the Elastic core network internal-only, and the read-only authorization probes returned **403** for the isolated index, **400** for the isolated saved view, and **200** for a Space listing with no isolated view. Neither this probe nor Kibana Spaces establish Analytics tenant isolation.

| Display condition | Browser-reported CSS viewport | DPR | Native zoom | Observed original screenshots |
| --- | --- | --- | --- | --- |
| Desktop | 1440×900 | 1 | 100% | Both revenue and saved-catalog views, 12 rendered charts each |
| Mobile | 390×844 | 1 | 100% | Both paths reached saved dashboard; no measured document-width overflow |
| Narrow | 320×900 | 1 | 100% | Both paths reached saved dashboard; no measured document-width overflow |
| Forced colors | 1440×900 | 1 | 100% | Both rendered chart surfaces; Analytics outlined keyboard-focused Share action, Kibana displayed focused skip link |
| Chromium zoom 200% | 720×406 | 2 | 200% | DevTools chart-target capture visibly contained the heading in both products |
| Chromium zoom 400% | 360×203 | 4 | 400% | DevTools chart-target capture visibly contained the heading in both products; only a portion fits in each viewport |

The first Tab on the revenue view focused Analytics' **Share** button and Kibana's **Skip to main content** link; this is a *difference*, not a measured preference. At native zoom, the chart-heading geometry intersected the effective CSS viewport and element hit testing found it unobscured for both. Some **Playwright scrolled screenshots appeared blank or header-only despite that geometry**, while independent DevTools pixel captures displayed the chart target. We retain *both* originals and classify the inconsistency as a **test/capture-script limitation**, not a confirmed product defect or proof of fully usable 400% zoom. Console observations recorded one network/resource error for Analytics and 13 network/resource plus one browser-policy error for Kibana per nominal display condition. The script also intentionally blocks third-party requests; raw potentially sensitive console text is not archived, and these groups have **no established product root cause**.

Analytics-only scripted journeys independently inspected the October **$41,400** table row (T04); Oct–Dec and Direct-only scoped data (T05), selective commerce reset retaining Direct (T06), full reset (T07), final-of-12 navigation (T08), and share-link inspection plus a new authorized context reopening defaults after temporary selections (T09). The *same-origin sample* iframe additionally exercised the October row, channel-filter/reset and saved-share-link surface (T13). Missing-resource navigation (T10A) and a controlled 503 screen (T10B) were run as Analytics-only recovery states. These are synthetic regression paths, **not** comparative human results. T03 remains unpaired because Kibana's undated series appears under a “Last 15 minutes” picker without the same explicit sample caveat; Kibana's precise October source record (T04), two independent dataset filters and resets (T05–T07), equivalent index return (T08), and link persistence (T09) remain unverified in the actual UI. T01 context/permissions are structurally different. T10A/B, T11, T12 and T13 remain excluded from paired scoring.

Classification: **no independently reproduced Analytics product defect** or authorized low-risk product correction in this increment; a corrected API-write assertion now covers the isolated iframe in addition to the standalone path. The observed zoom pixel mismatch is a **test-script/capture limitation**; the documented external console groups are **unattributed environment/browser observations**; missing parity for T01/T03–T09 and all explicit exclusions are **task-parity limitations**. Whether the different navigation, chart caveats, focus entry, time picker, and narrow/zoom layouts alter understanding or effort are **hypotheses for future consented human research**, not measured UX conclusions. The script produced no participants, recordings, external sharing, persistent telemetry, production data, or new integration contract.

Associated verification for that head: [Verify #44348628270](https://github.com/infoconex/analytics-dashboard/actions/runs/44348628270), [both-language CodeQL #44348628269](https://github.com/infoconex/analytics-dashboard/actions/runs/44348628269), [UX-13 lab smoke #44348629311](https://github.com/infoconex/analytics-dashboard/actions/runs/44348629311)—all successful. Subsequent documentation-only corrections must still pass PR-head checks and, after squash-merge, both main Verify and CodeQL. Do not prelabel any T02 pair as human-scoring-approved.
