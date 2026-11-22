# UX-13 — Independent evaluation lab and parity preflight

**UX-14 follow-on:** [Matched synthetic task paths and original visual evidence](ux14-matched-task-evidence.md) use this unchanged 9.5.6 laboratory baseline. The narrower T02 catalog-to-report browser-path candidate does **not** retroactively make the UX-13 screenshot smoke test a human study or prove T01–T13 parity. Keep the UX-13 immutable source digests and negative authorization probes separate from usability scores.

**Issue:** [#52](https://github.com/infoconex/analytics-dashboard/issues/52). Baseline: UX-12 merge `daf6656d98fb71bc23b1df1416f4f29e0bee7068`. **Status: lab preparation; no human research or paired superiority result.** This is a disposable, fictional, local-only evidence system. The research-consent/data-handling gate R0 is **unapproved**.

## 1. What is reproducible, and what is not yet a paired test

- The actual Elastic 9.5.6 Docker manifest-list digests and the uncredentialed Node 22.23.5 proxy image digest are pinned in [`lab/ux13/image-digests.json`](../lab/ux13/image-digests.json) and Compose; Elastic's registry supplied the former on November 17, 2026, and Docker Hub lists the latter on November 18. These are multi-platform manifests, not a claim that AMD64 and ARM64 render identically. The runtime captures selected image IDs/OS/architecture in `lab/ux13/evidence/environment.json`. Image signature verification is separately outstanding.
- The JSON and Elasticsearch bulk files in [`lab/ux13/fixtures/`](../lab/ux13/fixtures/) are generated *only* from the literal arrays in [`web/src/demoData.ts`](../web/src/demoData.ts). Their byte-level SHA-256 manifest detects drift. The importer refuses another cluster name/version or a non-loopback URL; it re-reads and compares every Elasticsearch document as a separate verification step.
- The lab configures two undated Kibana data views and a 12-panel dashboard matching the **titles/order** in `web/e2e/customerTasks.spec.ts`. Ten late-position charts deliberately repeat monthly revenue as the Analytics task fixture does. Kibana's ES|QL visualization configuration, browser rendering, actual click paths, filters and user-visible limitations still require execution and inspection on the pinned build. **Matching titles is not task parity.**
- A separate fictional Isolated Tenant index marker and saved data view in a restricted Kibana Space exercise negative access checks as a Northstar-only read viewer. An inaccessible Space's list endpoint may return `200` with an empty array; that alone is not a leak. Kibana 9.5.6 can return `400` for a restricted direct saved-view request. The lab first retrieves the exact sentinel with admin privileges (positive route/object control), then verifies the viewer receives `400`, `403` or `404`, that the list does not contain it, and that the isolated Elasticsearch index is denied. Actual HTTP statuses are recorded. Kibana Spaces/index roles do **not** prove equivalence with Analytics Dashboard server-enforced tenant identity. Study T11 and T12 remain **unpaired**.
- The Analytics sample UI remains unchanged: standalone and same-origin read-only embedded tests reuse existing sample-only routing. No production API/data sources, HTTP contracts, credentials, cross-origin messaging, participant telemetry, participant artifacts or recording code are introduced.

## 2. Pin manifest and data contract

| Source | Shape / exact check | Interpretation |
| --- | --- | --- |
| Commerce performance | 12 separate records, `month`, `revenue`, `orders`, `customers`; Jan $18,400; Oct $41,400; Dec $48,300 | USD monthly illustrative samples, January–December; **no specified year**; `monthOrdinal` 1–12 added solely as an ordering/filter field, **not a date** |
| Marketing channels | Five separate records, `channel`, `orders`, `sessions`, `conversion`; Organic search 1,820; Direct 1,530; Paid search 1,120; Social 890; Referral 615 orders | No dates. Conversion numbers are illustrative, not ratios calculated from the displayed fields. Never apply commerce time filters to channels or sum monthly `customers` as unique people. |
| Authorization fixture | A synthetic isolated index marker and separate Kibana Space with a sentinel saved data view; one Northstar-only viewer | Isolated index 403/404 and exact saved-view 400/403/404 with admin positive control are **Elastic-only** security evidence. Empty listings may be HTTP 200; a status without the returned object is insufficient. No real tenant records. |

The generated fixture's `sourceSha256`, file digests and deterministic IDs are part of the reviewed artifact. A source change must fail the fixture check until a human explicitly reviews and regenerates it; changing the protocol silently would invalidate the study.

**Important:** `createdAt` values in the Analytics *dashboard metadata* are not commerce observation dates and must never be used to assign a year to the source data. Neither product is allowed to use rolling "last 3 months" based on the real calendar. The intended filter is ordinal 10–12 (Oct–Dec).

## 3. Operator-ready disposable setup

Requires **Docker Engine 28.0+** + Compose, Node 24, npm and OpenSSL on a dedicated Linux machine or disposable Linux environment. Docker versions before 28.0 could expose localhost-published ports to hosts on the same Layer 2 network, so the lab rejects them before setup. Provide at least the memory required for Elasticsearch and Kibana (Elastic's official Docker guidance recommends allocating at least 4 GB to Docker Desktop). No production network bridge, real index, customer account or persisted identity is permitted.

From the repository root:

```bash
npm --prefix web ci --no-audit --no-fund
npm --prefix web run test:lab
bash lab/ux13/lab.sh up
bash lab/ux13/lab.sh verify
```

Open `http://127.0.0.1:15601` using username `ux13-northstar-viewer` and its **local** throwaway password from `lab/ux13/secrets.env`. Never copy passwords to screenshots, issues, CI artifacts or study materials. Elasticsearch is reachable only via `127.0.0.1:19200`. **Docker does not publish ports on an `internal: true` network.** Both data services therefore remain on that internal bridge, without outbound egress or published ports; a separate uncredentialed, read-only-filesystem, capability-dropped TCP proxy bridges only the two fixed ports from a second operator network to the host's loopback. The proxy receives no lab passwords. This access arrangement is test-only, not an application embedding or authentication contract. Elasticsearch HTTP inside this disposable network is unencrypted, so do not connect other workloads, expose interfaces, use real credentials or extend this configuration into production.

The script generates six 256-bit random local credentials/keys with restrictive file permissions, pulls **digest-pinned** images, starts Elasticsearch and the uncredentialed proxy, provisions the `kibana_system` password, imports strict-schema fictional records, starts Kibana, creates two undated data views and a matched 12-panel dashboard, then configures a read-only viewer. It checks version/cluster name, record counts and every field, cross-index denial, separate Space denial and viewer dashboard read access. Setup is fail-closed; it does not fake successes or skip a missing Docker runtime. On Elasticsearch bootstrap failure, it reports only Docker state, health and anonymous loopback HTTP status, never raw container logs or credentials, before the dedicated CI cleanup removes the disposable environment.

After inspection, **explicitly destroy only the named disposable lab**:

```bash
bash lab/ux13/lab.sh down
```

That removes `ux13lab` containers, its named Docker volume and the exact local `secrets.env` file. Remove the temporary evidence directory yourself once its non-sensitive evidence has been reviewed, subject to approved study governance. To reset the lab, tear down and run `up` again; *never* reset against an arbitrary Elasticsearch endpoint. Do not share the local admin credential with study participants.

### Immutable runtime evidence

`lab/ux13/evidence/environment.json` records Git head, host OS/architecture, Docker/Compose/Node, selected image IDs and repo digests, source fixture hash, expected dashboard definition hash, actual Kibana dashboard response hash, actual permission-snapshot hash and isolated-object HTTP status probes. The corresponding `kibana-dashboard-response.json` and `kibana-permissions.json` preserve the inspectable synthetic saved dashboard and role-privilege API results without credentials. `kibana-browser.json` records actual Chromium version, CSS viewport, DPR, document width, native `getZoom` factors, focus tag and captured screenshot filenames for 1440×900, 390×844, 320×900, forced colors, 200% and 400% zoom. The [manual External analytics comparison workflow](../.github/workflows/evaluation-comparison.yml) runs the same disposable setup on request and captures **scripted, synthetic screenshots only**; CI cleanup is unconditional. It is not a human usability session, AT speech assessment or WCAG audit.

### Hosted execution and screenshot observations (November 18, 2026)

Actual [UX-13 lab run #44336172697](https://github.com/infoconex/analytics-dashboard/actions/runs/44336172697) completed successfully on the PR head `28e8ad257b86e9c4757c1132fb58c041ce496e3d`. The artifact `ux13-fictional-lab` has a seven-day retention period. `environment.gitHead` was `8f1f8c2ed1633c0f718a9f1244a45f1eb0ae2296` (GitHub's synthetic PR test-merge checkout), not the actual PR head. Future reviewers must retain both values instead of treating them as interchangeable.

- Host: Linux x64, kernel `7.0.0-1019-azure`; Node `24.22.2`, Docker `29.4.2`, Compose `5.1.3`. Chromium `159.0.8154.6`. The three selected image platform IDs, two Elastic 9.5.6 digests and Node proxy digest match the checked-in manifest; the exact runtime response SHA hashes are in the archived `environment.json`.
- Independent fixture check: exactly 12 month records and five channel records, matching every original source field and sentinel; source SHA-256 `7f1d3338cab3b4733bd655e7c9271199ee729f4a53fc3b251b834fa91f19cf8b`. Both undated data views and all twelve saved panels were read back. No fictitious commerce year or channel observation dates were introduced.
- Isolation: the core network was internal, Elasticsearch and Kibana had neither published ports nor a default route, the proxy published only two loopback ports and held no lab credentials. The viewer received HTTP `403` for the isolated index, `400` for the exact isolated saved data view after a successful admin positive-control read, and `200` for an empty isolated Space listing. **A 200 empty list was not counted as a data disclosure or as tenant-model parity.**
- Rendered Kibana at `1440×900`: twelve chart components loaded, four in view and zero loading-chart placeholders. The visibly plotted January–December revenue curve ends at the fictional 48,300 value and channels appear in the expected 1,820/1,530/1,120/890/615 order. The toolbar nevertheless displays a relative **“Last 15 minutes”** time range even though the source observations are undated. The UI does not visibly identify the Northstar organization or dataset provenance on this captured view; these are T01/T03 pairing blockers, not proven data defects.
- At `390×844` and `320×900` the plotted charts stack vertically; document width equals viewport width (390 and 320 CSS px), and the narrow plot abbreviates month tick density. The first two chart headers are present. The initial keyboard `Tab` focused an anchor on normal desktop/mobile/narrow captures. This demonstrates one scripted focus path, not full keyboard operability.
- Forced colors at `1440×900` showed legible chart labels and high-contrast panel boundaries, with four plotted charts visible and zero loader placeholders; the initial active element was `BODY`, so no manual focus-ring or screen-reader assessment is inferred.
- Genuine Chromium zoom reported `2.0` (720×406 CSS viewport, DPR 2) and `4.0` (360×203 CSS viewport, DPR 4), with document widths equal to their CSS viewport widths. At 200% the enlarged Elastic header and filters dominate the image. At 400% the capture shows only the enlarged Elastic logo/header despite a chart existing in the page DOM. **Usable chart access at 400% is not established**, and automated scroll/DOM visibility is not proof of unobscured content.
- `kibana-browser.json` recorded zero JavaScript page errors. Initial screenshots were rejected because they showed loading placeholders; this evidence run waited for actual rendered Elastic Charts. The separate [Analytics Dashboard Verify artifact](https://github.com/infoconex/analytics-dashboard/actions/runs/44331953593) was also visually inspected at desktop/mobile/320px, forced colors, same-origin embedding, and genuine 200%/400% zoom (Chromium `159.0.8154.6`, observed 1440→720→360 CSS px, DPR 1→2→4). That is automated product-path evidence, not a paired human session.

**Parity decision:** Source records, chart count and broad graph content are reproducible; not one of UX-12 T01–T13 is yet independently verified as an **equivalent complete human task**. In particular the default relative-time UI, organization disclosure, exact supporting-row navigation, independently scoped controls, persistence and share semantics, failure recovery, tenant boundaries and embedding remain explicit differences or untested hypotheses. The task matrix therefore retains `ux13_verified_paired_now=no` for every row. No comparative superiority result or WCAG conformance assertion follows from this lab.

For Analytics Dashboard standalone and same-origin embedding, run the existing UX-11 [`customerTasks.spec.ts`](../web/e2e/customerTasks.spec.ts) via `npx playwright test --config playwright.customer-tasks-ui.config.ts` within `web` after installing Playwright Chromium. It covers the 12-widget workflow, exact records, independent filters, handoff/revisit, iframe no-writes, keyboard focus, three widths, forced colors and native zoom. Capture its real browser version, viewport, DPR, errors and screenshots. The existing complete Verify workflow also runs API-backed Playwright and real-provider tests. Do not reinterpret 11 scripted *milestones* or 14 scripted *interactions* as participant effort.

## 4. Per-task parity decisions (goals, not identical UI features)

No item is currently approved for *paired* human scoring. An importer/API pass only qualifies the source-data and authorization **setup** portions. A task becomes pairable **only after** two independently observed UI endpoints, starting state, role permissions, semantics, reset and reproducible evidence are signed off before the study. The UX-12 [machine-readable task matrix](ux12-task-matrix.csv) explicitly sets `ux13_verified_paired_now=no` for all tasks.

| Task | Source/goal alignment | Unresolved blocker or explicit exclusion |
| --- | --- | --- |
| T01 context | Fictional Northstar context and read-only viewer in Elastic | Kibana Space/context and Analytics organization/role presentation need separate observable checks; security models differ |
| T02 discovery | 12 title-matched panels are scripted for creation | Starting navigation/actual dashboard discovery not yet demonstrated end to end |
| T03 interpretation | Monthly USD and undated-source semantics documented | Kibana must visibly communicate the same metric caveats without coached text; UI not yet proven |
| T04 October exact row | Source fixtures match $41,400 | Independent table/Discover supporting-record path and viewer permission require UI evidence |
| T05 independent filters | `monthOrdinal=10..12` and `channel=Direct` are separately expressible in each index | Kibana's global controls may affect both views or persist differently; **do not** call them equivalent without actually observing scoped filters |
| T06 selective removal | Depends on T05 | No demonstrated independent Kibana selector removal while retaining Direct |
| T07 reset | Full 12 months + five channels present | No demonstrated equal reset and saved-state semantics |
| T08 dense navigation | Exactly 12 panels and same late target names | Index, keyboard focus/return and list hierarchy may have no equivalent counterpart |
| T09 share/revisit | Saved dashboard resource exists in setup script | Kibana share URLs may include filters/current view; Analytics links intentionally do not persist them. Confirm before pairing |
| T10A missing | Analytics 404 recovery is scripted | No matching Kibana saved-resource 404 and safe recovery state configured |
| T10B unavailable | Analytics 503 recovery is scripted | No controlled equivalent Kibana outage and recovery state configured |
| T11 unauthorized | Elastic index/exact isolated saved-view denial is independently tested; Space listing content is separately checked | **Security audit only**; Kibana Spaces are not Analytics tenants |
| T12 organization change | Separate fictional Isolated Tenant marker exists | **Analytics-only** until account-level isolation and switching semantics are proven; a Space change is not equivalent |
| T13 embedded | Analytics same-origin fictional host/read-only iframe covered by existing tests | **Analytics-only**; no production/Kibana host equivalence or cross-origin integration added |

## 5. Classification and independent evidence gates

| ID | Category | Evidence / next action |
| --- | --- | --- |
| DATA-13-01 | Deterministic fixture verification | Offline tests independently compare generated arrays/CSV-equivalent values, 12+5 source rows and fixed sentinel fields. Importer separately checks returned Elasticsearch documents. This is **not** UI usability. |
| ENV-13-01 | Local environment limitation | This execution host does not have Docker or .NET installed. Its Chromium subprocess was blocked by `socket() failed: Operation not permitted`. The first two hosted smoke runs also showed a **healthy** Elasticsearch on an internal-only Docker bridge with no host-published port; the script now uses a credential-free two-network proxy. This was a lab setup defect, not an Analytics Dashboard defect. Do not attribute these failures to either product. |
| SCRIPT-13-01 | Comparison design limitation | Browser automation operates from known endpoints; it does not establish that a real participant can discover them or understand the message. Some task controls are not yet matched. No simulated participant rows are written. |
| PROD-13-01 | Product defects | **None independently established in UX-13 at document time.** Any later observed defect must cite actual screenshot, reproduction and regression result; do not infer superiority from this absence. |
| HYP-13-01 | Human research hypothesis | People may misunderstand which filters persist or the meaning of yearless monthly data. Do not alter product copy or scoring based only on this hypothesis. |

**Gates remaining:** R0 approved owner, consent, access/retention/recording handling; R1 successful pinned image/fixture/dashboard execution **and** independent per-task UI equivalence; R2 real representative 8–12-person study; R3 actual NVDA/JAWS/VoiceOver/TalkBack/Orca paths as available; R4 full manual WCAG 2.2 AA audit; R5 separate production authentication, live-data, tenant and embedding security approvals. All are **unpassed** until supported by their own evidence. No recruiting, tracking, persistent telemetry, screen/audio capture, production integration, release or comparative-superiority claim is authorized.

## 6. Architectural and security review checklist

- Import, dashboard authoring and visual capture remain lab-only Node/Bash tools outside the application; no Domain/Application port, API route, runtime transport, authentication path or embedded contract changed.
- All Elasticsearch/Kibana API calls are fixed-loopback only; an exact cluster name and `9.5.6` check precedes any writes. The scripts accept no caller-supplied remote URL or production credentials.
- Read-only role privileges are scoped to two Northstar indices and the default Kibana Space; negative index and Space checks must independently fail, and are not taken as proof of Analytics tenant isolation.
- Generated documents preserve literal values and avoid a fabricated year, channel timestamp, data join or recomputed conversion. Hashes and 12 chart titles/order prevent silent fixture drift.
- This is a **temporary** Docker configuration with self-generated passwords, no external interfaces and internal-only network; it must not be deployed for customer access. Image provenance/signature and third-party service telemetry require independent review outside this lab.
- Browser captures are scripted screenshots of fictional records, not real assistive-technology speech, manual 200%/400% audit or actual participant evidence.
