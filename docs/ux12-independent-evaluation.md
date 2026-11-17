# UX-12 — Independent customer usability evaluation kit

**Tracking:** [Issue #50](https://github.com/infoconex/analytics-dashboard/issues/50). Baseline: UX-11 merge `7566e1d55d71cf712b12becb08115f8d0ac99218`. **Status: prepared, not conducted.** This kit is for independently observed people, not for deriving human outcomes from Playwright. No recruitment, participant recording, Kibana instance, real assistive-technology trial, WCAG audit, or comparative result is claimed.

**Purpose:** Determine whether people can independently recognize their organization and data provenance, answer a business question, inspect exact supporting data, manage filters, recover orientation and errors, and revisit/share an insight. The product principle is **simple by default, powerful when needed**. Treat task success as more important than feature count, visual preference or the smallest possible scripted click sequence.

## 1. Evidence ledger and research boundary

| ID / category | Evidence and interpretation | Decision |
| --- | --- | --- |
| OBS-12-01 — observed product defect | UX-11 forced-colors screenshot visibly showed a "Dashboards 0" sidebar count while a 503 dashboard-list request yielded "Dashboards temporarily unavailable." A failed authorization/data request cannot establish zero dashboards. | Hide count while no successful list is available for the current organization; keep honest empty state. Browser regression covers failure and recovery. |
| OBS-12-02 — observed presentation friction | The same actual screenshot displayed the raw "Request failed (503)" alert. That message does not tell a customer what to do and unnecessarily exposes transport vocabulary. | Use a brief actionable, safe failure notice; preserve retry and the dedicated unavailable state. |
| SCRIPT-12-01 — test-script defect | UX-11 CI JSON identified 11 named **milestones** as "deliberateActions", although the scripted path also selects visualization 12, expands context, closes the dialog, and contains multiple actions in one milestone. | Preserve 11 milestones; record **14 explicitly scripted interactions** separately with scope. Neither count represents human actions or time. |
| HYP-12-01 — human hypothesis | People may miss the optional question guide, metric caveats, exact-value disclosures or distinction between saved links and transient filters. | Ask neutral comprehension questions; do not add explanatory UI until observations support a barrier. |
| HYP-12-02 — human hypothesis | Dense index/return links may be discoverable with automation but difficult for first-time keyboard/screen-reader users. | Observe independent discovery, orientation loss and real AT speech. Do not count Playwright focus assertions as real AT validation. |
| HYP-12-03 — comparison uncertainty | A Kibana workflow may have different capabilities, permissions, navigation, embedding or data-filter semantics. | Verify each task's functional parity before recording a paired comparison. Mark non-equivalent tasks as standalone qualitative evidence. |

**Prior evidence:** UX-1 through UX-10 are documented in [roadmap](roadmap.md) and their increment guides. [UX-5](ux5-usability-study.md) supplies the original dense-navigation study draft; [UX-11](customer-task-validation-ux11.md) supplies deterministic task and CI evidence. UX-11's journey covers first question, chart interpretation, exact table, two independent filters, reset, visualization 12/index return, sharing and reload. Its former JSON count was a labeling error. The sample-only automated suite is not a participant study.

## 2. Study ownership, eligibility, recruitment and safeguards

**Gate R0 — explicit study and data-handling approval, currently unpassed.** A research owner must approve: named researchers and access controls; recruiting channel and compensation; legal/ethics review where applicable; consent language; whether notes, screen/audio/video or task telemetry are collected; storage region, access, retention period and deletion contact. This repository intentionally contains **no participant information, consent forms with signatures, completed observations, raw recordings, secret links or telemetry endpoint**. Do not launch participant sessions or enable monitoring until R0 is approved.

Recruit **8–12 distinct adults** who actually consume or create business analytics in their work, not only developers familiar with this repository. Use a prescreen to balance frequent consumers, occasional consumers and creators (aim for at least two in each cohort); record prior Kibana exposure and similar tools. Exclude maintainers/implementers of either tested interface from primary analysis and disclose any internal pilot separately. Avoid collecting protected diagnoses, medical details or irrelevant demographics. Include keyboard-only participants and people experienced with their own assistive technology if available, but run the real-AT coverage plan in §8 **in addition** to this usability sample. Invite participants unfamiliar with both products when practical; never require SQL knowledge.

Recruitment and participant assignment occur outside GitHub in approved access-controlled research storage. Use anonymous sequential IDs P01–P12, with the identity/contact lookup stored separately. A participant may stop, skip questions or opt out of recording without losing compensation. Obtain consent **before** any recording. Offer a notes-only alternative or no data capture according to the approved plan. Do not ask participants to enter real credentials, disclose customer data or visit production systems.

**Eight-person minimum:** P01/P03/P05/P07 use A→B; P02/P04/P06/P08 use B→A. For 10 or 12, append P09 A→B, P10 B→A, P11 A→B, P12 B→A. Here A is **Analytics Dashboard at the pinned UX-12 SHA**, B is **Kibana 9.5.6 + Elasticsearch 9.5.6**. Within each product, alternate the task order in two pre-piloted, dependency-preserving blocks (P01/P04/P05/P08: orientation→understanding→interaction→recovery; P02/P03/P06/P07: orientation→interaction→understanding→recovery). Keep state-dependent tasks together; do not reverse T05/T06 without a reset. Rotate variant X/Y targets (defined below) between products and order in balanced cells. For 10/12, extend the same cells evenly. Log the actual sequence, form, cohort, equipment and any deviation, not just the intended allocation.

**Session load and fatigue:** Pilot duration before recruitment. Plan two ~45-minute appointments (or a consented equivalent with breaks) if all scored core tasks would otherwise exceed one comfortable session: ~5 minutes consent/context, ~5 minutes neutral training per product using an unrelated fictional practice dashboard, the matched core T01–T09 in counterbalanced product blocks, optional assigned recovery/boundary T10–T13 probes after both product blocks, and ~5 minutes debrief. Preassign rotating recovery/boundary subsets so every scenario is exercised across the sample without requiring all 13 tasks from every person; report the actual per-task denominator. Do not pair Analytics-only probes with imaginary Kibana counterparts. Provide the same navigation basics and practice goal, never task-specific controls. Predeclare **six minutes maximum per task** and record interruptions and censoring. Pause/reset between products; do not give the correct answers after product A if those answers would transfer to B. Never instruct a participant to use a specific UI control in a scored task.

## 3. Locked fictional environments and Kibana parity gate

Both products must be isolated, disposable, read-only-to-the-participant wherever the task is consumption, and populated with **synthetic data only**. Pin Analytics SHA, test browser/OS, viewport and device; capture Kibana/Elasticsearch full build versions and container image digests or package SHA checks. Elastic's [9.5.6 release announcement](https://www.elastic.co/blog/elastic-stack-9-5-6-released) is dated November 2, 2026; [Elastic installation guidance](https://www.elastic.co/docs/deploy-manage/deploy/self-managed/install-kibana) specifies matching Elasticsearch/Kibana versions. Neither pinned Kibana instance nor its feature parity has been verified in this increment.

**Source-of-truth manifest:** `web/src/demoData.ts` at the evaluated commit; `web/e2e/customerTasks.spec.ts` defines a 12-widget fictional Northstar Commerce dashboard. For the equivalent Kibana fixture, import the same two **separate** sets, not a blended join:

| Fictional dataset | Fields / required records | Verifiable sentinel values and limits |
| --- | --- | --- |
| Commerce performance | 12 monthly records Jan–Dec, fields `month`, `revenue` (USD), `orders`, `customers`; year **unspecified** | Jan revenue **$18,400**, Oct **$41,400**, Dec **$48,300**. Final-three-month date selection means Oct–Dec, not rolling real dates. Do not claim distinct customer totals. |
| Marketing channels | Five category records with `channel`, `orders`, `sessions`, `conversion` | Organic search **1,820 orders**, Direct **1,530**, Paid search **1,120**, Social **890**, Referral **615**. Conversion rates are illustrative, not computed from displayed orders and sessions. No observation dates. |
| Tenant/scoping fixtures | Northstar Commerce plus a separate fictional Isolated Tenant; viewer account and restricted destination fixtures | No access through an unauthorized URL. A Kibana *space* is **not** assumed to have equivalent tenant-security semantics. Test role behavior separately. |

Use equal dashboard purpose and card titles/units, 12 corresponding visualizations (including a late-position target), same ordering and filter semantics, similar ability to view exact records, and equivalent saved-resource links. Kibana's time filtering may require **synthetic explicit dates**; if so, add a documented non-sensitive mapping to an artificial calendar solely in its imported fixture, and ensure the visible task instructions do not imply real current dates. Before each scored task, verify sentinel values, record counts, permitted roles, expected filter scope and saved/unfiltered starting state on **both** products. Save checksum of import file, Kibana dashboard export hash, permissions snapshot and seed/reset script version in restricted study setup logs.

**Parity is a gate per task, not an assumption.** Researchers must run a preflight table for every `Txx`: equivalent goal, dataset and exact values, participant permissions, reachable endpoint, starting state, safe resets, and what cannot be matched. Mark `paired_eligible=no` and explain differences when, for example, Kibana has no comparable organization switch, 12-widget index, read-only iframe host, stale simulation or unavailable-link state. Never score a missing counterpart as a product failure simply because a different architecture provides different features. Do not claim a security isolation comparison from visual UI testing. Do not run Elasticsearch/Kibana against live enterprise data.

### Reproducible setup and reset

1. Checkout pinned Analytics SHA; use only the sample API and existing same-origin sample host. Capture exact browser and system versions, CSS viewport, DPR and actual zoom.
2. Provision pinned Kibana 9.5.6 and Elasticsearch 9.5.6 in an isolated, approved lab; record immutable image digests/build and verified source checksums. No network bridge to production; dedicated throwaway test users and storage.
3. Import fictional commerce and channel datasets and configure matched views and privileges. Validate all sentinel rows and textual limitations in both products. A 12-widget visual arrangement alone does not establish matched functionality.
4. Produce a sealed, read-only per-task start snapshot. Reset both products' filters, search, scroll position, browser zoom, modal state, current organization/space, navigation history and any edits before each independent task. Preserve state **only** for a stated dependent task (T05→T06→T07).
5. Pilot all prompts and expected endpoints with **internal staff who do not count as participants**. Lock task wording, score rubric, timing cap, help policy and parity decisions before recruitment. Document protocol deviations without retroactive outcome changes.
6. For standalone screens test 1440×900 CSS px plus separately 390×844, 320×900, real Chromium tab zoom 200%/400% and forced colors. Use the same physical input method across products in each paired condition. Test same-origin embedding separately as Analytics-only unless a strictly equivalent Kibana read-only host is demonstrated.

## 4. Neutral task cards and success criteria

Read only the **participant prompt**; the moderator silently scores against the endpoint. Prompts avoid naming navigation controls, exact UI patterns or the expected answer. The [machine-readable task matrix](ux12-task-matrix.csv) has the same IDs, preconditions and parity status. Do not tell participants the success rubric.

| Task | Participant prompt | Pass endpoint / independently checkable criterion | Eligibility |
| --- | --- | --- | --- |
| T01 — arrival/context | “You have just opened the analytics workspace. Tell me whose information you are looking at, whether it is real or practice data, and what kind of access you have.” | Correct organization, synthetic provenance and role/access boundaries, without false live-data claim | Paired only if context and permissions are equivalently visible |
| T02 — discovery | “A colleague asks how revenue is changing. Find the dashboard or view you would use to investigate.” | Reaches the fictional commerce revenue chart in the intended permitted workspace | Paired after matching view/dashboard starting locations |
| T03 — meaning | “What can this revenue chart tell you, and what important conclusion should you avoid drawing from it?” | Correctly identifies USD, Jan–Dec undated sample, no reliable year-over-year/real-customer inference | Paired if both supply equivalent provenance and limitations in the task setup |
| T04 — exact values | “What precise revenue amount is shown for October? Show me the supporting record.” | **$41,400**, inspectable October supporting row; not a chart-height guess | Paired |
| T05 — independent filters | “Narrow the monthly view to its last three sample months and the channel view to Direct. Tell me which information each choice affects.” | Commerce Oct–Dec; channel Direct only; articulates independent scopes | Paired only with verified independent dataset-level filters |
| T06 — selective removal | “Keep the Direct channel selection, but restore the full monthly history.” | Channel still Direct; commerce Jan–Dec | Paired dependent on T05 |
| T07 — reset | “Return both views to their original unfiltered records.” | All 12 months and five channels restored without changing saved definitions | Paired dependent on T06 |
| T08 — dense navigation | “Find the last visualization in the 12-part dashboard. Then return to where it is listed among the others.” | Correct last visualization and reorientation to exact list entry (or verified equivalent counterpart) | Paired only if comparable list/index exists |
| T09 — share/revisit | “Prepare a link that an authorized colleague could use for this saved business view, then revisit it yourself. Explain whether your temporary selections and expanded explanations travel with that link.” | Reviews or copies authorized saved link, revisits default state; clearly distinguishes ephemeral context; no external message sent | Paired only after link semantics are verified |
| T10 — missing/unavailable | “This saved destination no longer opens. Find a safe way back to another available business view.” | Correct recovery from pre-injected missing item or temporary service-unavailable fixture; no false ‘zero dashboards’ conclusion | Separate subcases; pair only with comparable error mechanism |
| T11 — unauthorized | “A supplied link points to a workspace you cannot access. What can you do next?” | No unauthorized content; safe authorized destination and accurate explanation | Security boundary audit plus qualitative study; **not** paired without equivalent access model |
| T12 — organization change | “Switch to the other fictional organization, then check which reports and temporary selections are still present.” | Correct new organization, no prior-tenant reports or carried transient filters | Analytics-only unless independently equivalent account isolation verified |
| T13 — embedded journey | “In this fictional customer portal, find the exact October value, narrow the channels, clear the selection and review how you would share the saved report.” | Same-origin iframe: exact row, read-only filters/reset and link handoff, **no writes** | Analytics-only by default; production embedding is out of scope |

**Balanced forms for exact-value tasks:** For T04, X asks October revenue **$41,400**, Y asks January revenue **$18,400**; both require one month lookup. For a separate channel exact-value follow-up under T05, X can ask Direct **1,530 orders**, Y Paid search **1,120 orders** only when not simultaneously requiring Direct selection. Assign forms across products and participant order so neither product always receives one form. Log the form and expected endpoint. Do not reuse an already-revealed numeric answer as a scored comprehension measure. T08's target must be equivalent in both matched dashboard configurations.

For T10 split missing (404), service unavailable/stale (503) and expired/unauthorized (403) as independent cases; do not silently collapse into one score. Expose failures using a pre-scripted fictitious link or deterministic test outage; moderator must not interfere during a task. If a trial could reveal another tenant's data, abort immediately, preserve minimal security evidence outside participant capture and open an incident process.

## 5. Facilitator script and measurement contract

**Opening (read verbatim after consent):** “We are evaluating how the tools support work, not testing you. Some data is intentionally fictional. You may use whatever method you normally use, think aloud if comfortable, skip any task, or stop. I may be quiet while you work. Please tell me when you believe the task is finished.”

**Before each task:** Restore the approved start state, announce product neutrally as “workspace A” or “workspace B”, read the card once, answer only questions about what a task *means* using a prewritten, product-neutral clarification. Do not point at controls, recommend a route, confirm answers mid-task or coach one product more than the other. Start timing after the participant finishes hearing/reading the task. Stop on correct demonstrated endpoint, explicit abandonment, participant stop or the predeclared six-minute cap. Record end-state evidence **before** resetting.

**Allowed non-leading support:** If silent for 60 seconds, ask “What are you considering?” once per task if the participant agrees. If stuck, “You can continue or stop this task” is allowed. Any specific hint must be requested, counted and scored as assisted rather than unassisted success; use the same written hint policy for both products. Record all interventions, interruptions and deviations. Never steer toward a product-specific control.

**Counting rules:** One *deliberate action* is a participant-triggered purposeful click/tap, menu selection, key command or entry of a search phrase (record constituent key events separately only for an AT/keyboard effort study). Navigation transition = change of page, tab, dashboard, workspace or modal; log direction and whether intended. A recovery attempt is a discrete effort to correct a wrong destination/state (backtrack, reset, re-open, change strategy or seek help), not every subsequent click. Record errors and unnecessary actions against the pre-piloted minimal legitimate paths; do not assume the automation's minimum is the human optimum. Count unsuccessful attempts and assistance. For timing, use one consistent monotonic timer across products and store elapsed seconds; do not reconstruct times from video timestamps. Log timeouts as censored and keep failures in denominators.

**Outcome rule:** `complete_unassisted` only if every required endpoint is correct within cap without a task-specific hint. `complete_assisted` if correct after hint. `partial` if at least one endpoint is demonstrated but not all. `fail` if wrong or unrecovered. `timeout` at cap. `abandoned` if participant stops. `blocked_environment` if a verified test-platform failure invalidates the attempt; retain with reason and rerun policy, never silently drop it. Inaccessible controls are product failures unless the setup itself is demonstrably broken. Record first-attempt success separately if measured.

**After each task (ask without suggesting the answer):**

1. “What do you think the result means? What would you *not* conclude?” Record answer against a locked 0/1/2 rubric: 0 incorrect/unsupported, 1 partly correct, 2 correct including the key limitation. For pure navigation tasks use “Where are you now, and how do you know?” with task-specific key criteria.
2. “How easy or difficult was this task?” 1 = extremely difficult; 7 = extremely easy.
3. “How confident are you in that answer or outcome?” 1 = not at all; 7 = extremely.
4. “Was anything unclear or unexpectedly difficult?” Free-form, optional, no leading options.

**Post-session:** “Which experience, if either, would you prefer for these tasks, and why?” Allow no preference or unable to compare. Ask for the most important improvement, not a forced winner. Debrief after *both* products; keep preference separate from observed correctness.

## 6. Capture, quality and privacy

Use the blank [observation CSV](ux12-observation-template.csv) only as a **schema**; copy it to approved private research storage before populating. One row per anonymous participant/product/task/condition; provide an event timeline and redacted qualitative notes in a separate private event log keyed by task attempt. Record hardware/OS/browser, Chrome zoom **getZoom** result, CSS viewport, DPR, accessibility mode, task form, ordering, dataset/build hashes, start-state reset, permissions, endpoint, consent, assistance and any interruption. Screenshots from scripted fixtures contain only synthetic values and may be stored in short-lived CI artifacts; participant video/audio/screenshots must never go to GitHub Actions, source control or public issue attachments.

Minimal principle: collect only metrics approved at R0. Disable third-party analytics, persistent telemetry and automatic browser recording for the study unless explicitly approved. Redact account identifiers, URLs containing tokens, names, email addresses, passwords, customer data and background tabs. Store raw consent separately from observations; restrict access to named researchers; define encryption, backup, retention/deletion and incident procedures before a single session. Do not create a participant tracking service inside Analytics Dashboard.

Run two-coder calibration on at least one **consented** observation (or an internal fictional dry run) using the scoring rubric; disclose disagreement and resolution. Record observer code, protocol version and any missing data. Investigate setup failures before assigning them to the product. Prevent moderators from reviewing other participants' preference outcomes before their own sessions if possible.

## 7. Analysis and claim gates

Use [blank results template](ux12-results-analysis-template.md). For each *parity-approved* task and product report denominator, unassisted/assisted/partial/fail/timeout/abandoned counts, median and IQR of **completed** times, all censored durations separately, deliberate and unnecessary actions, navigation transitions, recoveries, hints, comprehension rubric distribution, ease/confidence distributions, orientation-loss notes, and barrier severity. Include paired participant-level differences only where both trials are actually equivalent and usable; disclose attrition, prior-tool exposure, missing observations and learning/order effects. 8–12 people supports discovery and directional estimates, **not** statistical proof of superiority or representative population performance. Do not pool non-equivalent tasks or turn a subjective preference into a product-wide result.

Severity triage: **blocking** (cannot reach correct endpoint, unauthorized disclosure, inaccessible critical control), **major** (requires assistance or substantial recovery), **moderate** (avoidable repeated confusion), **minor** (cosmetic or non-blocking); pair each claim with observed event IDs and participant counts, then explain inference and alternative interpretations separately. Record exact provenance of screenshots/logs and avoid citing scripted completion as human success. Research owner signs off findings before creating a new implementation issue.

**Independent gates remain unpassed:** R0 data handling/consent; R1 Kibana build and task parity; R2 human pilot and 8–12 moderated participants; R3 genuinely observed screen-reader/AT trials; R4 comprehensive WCAG 2.2 AA audit; R5 external security and customer-production readiness. Do not make product superiority, WCAG-conformance or validated usability claims before the relevant gate.

## 8. Separate genuine assistive-technology evaluation

This is **not** an axe/Playwright replacement. Recruit experienced real users and/or qualified AT evaluators with their own preferred configurations. Observe spoken announcements, reading/focus order, forms, dialogs, chart alternative tables, filters/reset, dense return, missing destination recovery, share handoff, tenant switch and same-origin iframe. Run keyboard-only tests independently; do not assume keyboard success implies screen-reader success.

| OS / browser / AT | Mandatory observation |
| --- | --- |
| Windows 11 / Chrome / NVDA | Announced workspace, headings, filtered status, exact row, focus after navigation/reset, modal return |
| Windows 11 / Edge / JAWS | Same independently; record virtual-cursor/Tab commands and speech, not only DOM attributes |
| macOS / Safari / VoiceOver | Rotor landmarks/headings, chart tables and dialogs |
| iOS / Safari / VoiceOver | Touch exploration, organization picker, reflow, iframe navigation and focus |
| Android / Chrome / TalkBack | Swipe/touch reading order, disclosures, filters and recovery |
| Linux / Firefox or Chromium / Orca, when available | Independent speech and focus checks; document actual session availability |

Record AT and browser versions, OS, device/physical zoom, exact commands, spoken text (only with consent), expected versus observed destination and success/failure. Mark an environment **untested** when unavailable. A visual screenshot, accessibility tree, axe pass or synthetic screen-reader simulation cannot substitute for spoken user observations. Run manual contrast/reflow/focus evaluation at genuine 200%/400% browser zoom and forced-colors setting, then a separate full WCAG audit by qualified reviewers. Do not assert conformance from passing automation.

## 9. Execution sign-off checklist

- [ ] R0: named owner, eligibility/recruitment, consent and data retention/access approved before collecting participant information.
- [ ] R1: pinned full products and fictional import parity; per-task equivalence, roles and resets piloted.
- [ ] R2: 8–12 consented participant sessions, with full outcome ledger and disclosure of exclusions.
- [ ] R3: actual AT devices/people, spoken behavior and keyboard evidence.
- [ ] R4: audited WCAG 2.2 AA scope, success criteria, findings and remediation.
- [ ] R5: separate production architecture/security readiness; no inference from this sample-only kit.

The present UX-12 work satisfies **preparation**, not these execution sign-offs.
