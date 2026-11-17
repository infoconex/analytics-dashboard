# UX-12 — Results analysis (blank template)

**Status: NO HUMAN DATA COLLECTED.** Never fill a result from scripted Playwright, UX-11 screenshots, a simulated participant or moderator expectation. Copy this template into private approved research storage after [R0 approval](ux12-independent-evaluation.md) and link the approved version back by non-sensitive reference only.

## 1. Study registration

| Field | Entry |
| --- | --- |
| Research owner and protocol version | **Pending** |
| R0 data-handling and consent approval/reference | **Unpassed** |
| Cohort recruitment dates and inclusion criteria | **Pending** |
| Participants consented / excluded / completed | **Not measured** |
| A product commit + deployment hash | **Pending exact evaluated SHA** |
| Kibana + Elasticsearch versions, image digests, fixture import hashes | **UX-13 manifest and lab scripts prepared; actual study run/version/import evidence must be attached and reviewed** |
| Per-task parity preflight / approved paired IDs | **Unpassed; see UX-13 explicit exclusion matrix (no pairs yet)** |
| Browser/OS/input/AT version matrix | **Pending** |
| Timing cap and counterbalance assignment | **6 min proposed; lock in pilot** |
| Missing data, deviations, interruptions, censor policy | **Pending** |
| Data-retention and redaction audit | **Unpassed** |

## 2. Raw evidence inventory (private references only)

| Anonymous event or task ID | Product / task / environment | Observation or evidence reference (no PII) | Classification: observed fact, interpretation, hypothesis | Confidence / alternative explanations |
| --- | --- | --- | --- | --- |
| *No rows until observed* | | | | |

Retain consent, raw media and participant identifiers only in separately approved private storage; **do not insert raw participant data in this repository or public issues**.

## 3. Task-by-task descriptive results

One row per product + task + cohort/environment. Do not aggregate paired outcomes when parity is unapproved.

| Task | Product/build | n attempted / n parity-qualified | Unassisted / assisted / partial / fail / timeout / abandoned / setup-blocked | Completed-time median [IQR], seconds | Censored trials | Actions / unnecessary / transitions / recoveries summary | Comprehension 0/1/2 | Ease and confidence (1–7) | Evidence references |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| *No human measurements yet* | | | | | | | | | | |

For *each* n, name excluded/missing and cap reasons without revealing participant identity. Show successful-time summaries alongside all timeouts/abandonments; never make a failed trial disappear by calculating only successful medians. Include frequency of hints, keyboard/AT sequences, orientation losses and severity per task. Prefer raw distributions with n rather than unsupported precision.

## 4. Paired comparison (only R1-qualified task pairs)

| Task/form + eligibility rationale | n matched pairs | Paired unassisted success difference | Paired elapsed-time difference (valid completed pairs only) | Paired recovery/action difference | Order, familiarity, form, setup confounders | Interpretation and uncertainty |
| --- | --- | --- | --- | --- | --- | --- |
| *No comparable participant pairs yet* | | | | | | |

Provide medians/IQR and participant-level direction counts. Distinguish exploratory signal from generalizable superiority; 8–12 participants do not establish market-wide, cross-role or cross-device performance. Never compare unsafe or unmatched tenant/embedding workflows as though they were equivalent.

## 5. Findings register and engineering decisions

| Finding ID | Verified observations / participant counts | Actual barrier and severity | Inference (clearly marked) | Alternative explanations / missing data | Recommended minimal change | Acceptance scenario | Re-test decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| *No human findings yet* | | | | | | | |

Severity rubric: blocking (incorrect endpoint, inaccessible critical action or disclosure); major (assistance or extensive recovery); moderate (repeated non-blocking confusion); minor (isolated visual friction). Keep an observed fact distinct from a moderator theory, participant preference and feature idea. Security incidents follow the security response process rather than participant feedback handling.

## 6. Independent accessibility and security gates

| Gate | Evidence required | Status |
| --- | --- | --- |
| R0 — approved participant data handling | Consent/retention/access/recording policy and research owner | **Unpassed** |
| R1 — pinned Kibana 9.5.6 + ES 9.5.6 and parity | Reproducible imports, permissions, hashes, per-task endpoints | **Unpassed** |
| R2 — 8–12 real participants | Consent and complete anonymous task ledger | **Unpassed** |
| R3 — genuine AT speech and navigation | Actual NVDA, JAWS, VoiceOver, TalkBack and available Orca sessions | **Unpassed** |
| R4 — full WCAG 2.2 AA audit | Scope, criteria, manual evidence, findings and closure | **Unpassed** |
| R5 — production security and readiness | Separate authentication/tenant/runtime/embedding review | **Unpassed** |

## 7. Decision and claim review

- Can the team support a product change with observed evidence, or is it still a hypothesis? **Pending**.
- Did paired tasks actually offer equivalent goals/data/roles/endpoints? **Unverified**.
- Were all failures, timeouts, assistances and censored durations reported? **No human data yet**.
- What real AT issues or inaccessible controls need correction? **Not tested with real AT**.
- Is a comparative, WCAG-conformance or human-usability claim justified? **No**.
- Owner, date and decision on next increment: **Pending**.
