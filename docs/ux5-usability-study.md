# UX-5 — Task-based usability and Kibana comparison readiness

Tracking: [Issue #36](https://github.com/infoconex/analytics-dashboard/issues/36). Builds on [UX-4g's human and screen-reader protocol](accessibility-ux4g.md), with scenario-focused instrumentation and task definitions. **Status: scripted evaluation only; human recruitment, observations, real assistive-technology speech and direct Kibana comparison are pending.** This document is a study kit, not a usability finding or WCAG conformance report.

## Evidence-led navigation increment

The twelve-widget dashboard offered a collapsed, correctly labeled index. Once the summary was focused, the existing scripted keyboard path to widget 12 used **Enter + 12 Tab presses + Enter = 14 key presses**, excluding the cost of discovering/focusing the index. It was usable but unnecessarily sequential for an explicit target. UX-5 adds an always-visible, named native visualization selector and a Go action for dashboards with eight or more widgets. The default prompt cannot navigate; the selection resolves against the current widget set, preventing stale selections from jumping after deletion. The existing expandable list, semantic headings and return-focus behavior remain.

On the deterministic widget-12 task, the new scripted path from a focused selector is **End + Tab + Enter = 3 key presses**. This comparison concerns *instrumented keystrokes with intentionally equivalent starting focus*, **not** user completion times, learnability, screen-reader keystrokes or a measured 79% improvement for people. Each result must be checked against the CI `ux5-scripted-task-evidence.json` artifact before reporting it as passing. All dashboard and filter data are fixed, fictional UI samples.

## Environment and parity preflight

1. Check out the exact evaluated Analytics Dashboard commit; run the disposable sample API fixtures from `web/e2e/visual.spec.ts` and the 12-widget `denseDashboard`. Capture SHA, Node/React/Chromium and host OS versions. Disable production database transports and external analytics sources. Do not use real client data.
2. The proposed comparison baseline is **Kibana 9.5.6 with Elasticsearch 9.5.6**, released November 2, 2026, as documented by [Elastic](https://www.elastic.co/blog/elastic-stack-9-5-6-released). [Elastic's installation instructions](https://www.elastic.co/docs/deploy-manage/deploy/self-managed/install-kibana) require matching Stack versions. Prepare a sandboxed instance **before recruiting**, and record actual image digests/build, operating system, browser and viewport, permissions, datasource import SHA and dashboard export SHA in the study log. **This Kibana instance has not been installed or verified; version and parity are proposed, not executed.** Use the same fictitious categories and values, 12 corresponding visualizations, and a comparable role permitted to view, filter and edit. Document any unavailable feature; exclude non-equivalent tasks from paired conclusions.
3. Reset both tools to unfiltered, saved dashboards before each participant/task. Verify source order and values: *Organic search = 1,820 orders; Direct = 1,530 orders*. The channel set is Organic search, Direct, Paid search, Social and Referral. Verify the date filter affects commerce, not channels. Clear draft changes and active filters, reset scroll/zoom, and test return navigation.
4. Standard desktop environment: 1440×900 CSS px, default zoom; use one chosen browser and physical hardware per participant across both products. Also test 390×844 mobile; 320×900 reflow; real browser tab zoom 200%/400% separately, logging CSS viewport, DPR and actual zoom factor. Do not describe 320px resizing as native zoom.
5. Confirm security and privacy: synthetic study organization, least privileges, no customer datasets, test profiles only, no imported secrets, no production database connections. Pilot every instruction, expected endpoint and recording field with an internal moderator before the human sessions.

## Participants, counterbalancing and consent

Recruit **8–12 representative participants**, balancing frequent and infrequent dashboard consumers and dashboard creators; include keyboard-only users and people using their own screen-reader configurations when possible. Track cohort/device/AT experience without collecting diagnoses or unnecessary demographics. Recruitment, scheduling, compensation and moderator assignment are **pending**.

Use a within-subject design: alternate `A→B` and `B→A` (`A` Analytics Dashboard, `B` Kibana) by anonymous participant ID; rotate task ordering within each product, matched training duration and the same reference data/permissions. Pause between tools, allow comparable learning, and record a failed or abandoned task as such. Randomize alternate equivalent datasets if learning transfer becomes material; never silently discard such trials. A small sample supports directional discovery, not broad market superiority or statistical certainty.

Before beginning, explain purpose, voluntary participation, right to stop or skip, any screen/audio recording, what is being collected, access/retention window and deletion contact. Obtain explicit consent **before recording**; recording is optional. If a participant declines recording, take only consented anonymous coded notes. Do not capture passwords, private browser tabs, customer data, screen-reader personal settings, identifiable speech or participant names in committed files. Store raw consent and research data in access-controlled research storage separate from GitHub/CI; limit access to the named research team and delete on the agreed retention schedule. This repository contains only empty templates and fictional fixtures.

Moderator reads the exact task prompt below without naming a control. Begin timing on completion of the spoken/read prompt; stop at observed correct endpoint, abandonment, or fixed cap (choose and record cap, e.g. 5 minutes, in the session plan before testing). Keep assistance scripts identical across products. Note timeouts, interruptions, resets and accessibility barriers in the task record.

## Task scripts and success criteria

Execute as separate tasks where possible; use the same wording, training and success endpoints for both products. Some tasks depend on the state from a preceding task—explicitly log whether that state was reset.

| ID | Participant prompt | Success observed by moderator |
| --- | --- | --- |
| T01 | “Open the business performance dashboard. Tell me what it covers and what you can do here.” | Identifies purpose, 12 visualizations, sample scope, available filter/view/edit actions without prompting |
| T02 | “Find visualization 12, Channel details — regional, then return to its entry in the visualization list.” | Correct card reached; exact list entry focused/located on return |
| T03 | “Which marketing channel has the most orders, and exactly how many? You may use anything in the dashboard.” | Answers Organic search, 1,820 orders, without relying only on relative chart heights |
| T04 | “Show the numerical data underlying Orders by channel and explain what the Direct row means.” | Opens/reads native table, identifies Direct 1,530 orders |
| T05 | “Show only the Direct marketing channel.” | Channel filter applied, no other channel shown in channel visualizations |
| T06 | “Explain which filter is active and how it changed the dashboard.” | Recognizes Direct, 1,530 orders and scope (channel charts; commerce unchanged) |
| T07 | “Return the dashboard to showing all marketing channels.” | Removes/reset filter; all five channels and original exact insight restored |
| T08 | “Enter the mode in which you can change this dashboard.” | Editing controls present, saved dashboard not modified |
| T09 | “Find the available kinds of visualization you could add. Tell me two options.” | Opens gallery; identifies two chart types via labels/description |
| T10 | “Leave editing without changing the saved dashboard.” | Cancels dialog and editing, no created/reordered widget or unwanted persistence |
| T11 | “Repeat navigation, number lookup and filtering on a phone-sized screen and at 200% and 400% real browser zoom.” | Relevant action and focus remain reachable; no unintended page-wide horizontal scroll; separately log each environment |

## Research recording

The header-only [participant/task template](ux5-task-observation-template.csv) is for a protected research copy; do not commit completed records. Assign one row **per participant, product, task and environment**. Keep a separate anonymous lookup for participant scheduling outside the research export. Record:

- Completion: complete/partial/fail/abandoned; elapsed seconds and predeclared cap; incorrect actions, backtracks, assistance count and exact assistance script; focus/Tab or real screen-reader navigation operations if observable; orientation-loss count.
- Clarity and ease: separate participant 1–7 ratings after each task; optional barrier description and severity (none/minor/major/blocking); comments and verbatim quotes only if consented, anonymous and redacted.
- Environment: product/version/build, browser/OS, device/viewport, actual browser zoom, AT name/version, participant cohort, ordering sequence, task-order index, start-state reset and interruptions. Do not treat browser accessibility-tree assertions as spoken output.
- Data quality: observer initials/pseudonym, consent for notes and (optional) recording, task equivalence flag and reason; retained/omitted trials with a documented reason.

Summarize per product/task and cohort: n, completion/partial/failure, median and interquartile times with censored/abandoned trials disclosed, incorrect actions, backtracking, assistance, keyboard/AT effort, clarity/ease distribution, orientation loss and severity. Report uncertainty and paired differences transparently. Avoid a product-wide “better than Kibana” claim without equivalent tasks, representative observed participants and direct evidence.

## Automated regression evidence versus human outcomes

`web/e2e/visual.spec.ts` runs a deterministic sample-only journey: widget-12 direct Go, exact return to indexed item 12, Organic search 1,820 table/insight, Direct 1,530 filtering and reset, gallery/cancel safety, axe, viewport 1440/390/320, screenshots and forced colors. A separate existing browser-native Chromium tab-zoom test runs at 200% and 400% and records actual DPR, CSS viewport, focused-heading visibility and raw Chrome-view screenshots. `ux5-scripted-task-evidence.json` reports scripted key presses and expected outcomes. **Automated pass/fail, screenshots and measured key presses are not human task rates or AT speech.** Local browser execution may be blocked by process isolation; GitHub Actions is the authoritative browser runner when that occurs. Keep CI screenshots under controlled, fictional data only.

Evidence checklist for reviewers:

- [ ] Inspect UX-4g baseline screenshot and UX-5 first-arrival, mobile, 320px, forced-colors and native 200%/400% actual Chrome-view images at original resolution.
- [ ] Inspect machine-readable task evidence and control geometry; confirm focus not obscured by sticky top bar, no full-document overflow.
- [ ] Confirm sample-only boundary, revision-based saving, tenant and permission checks untouched.
- [ ] Verify NUnit, SQL Server/PostgreSQL integration, Vitest, Playwright, production build, C# CodeQL and JS/TS CodeQL.
- [ ] Recruit consenting people, run the protocol and complete the per-task observation records before asserting usability results.

## Real screen-reader execution matrix

| OS | Actual browser + screen reader | UX-5 status / evidence needed |
| --- | --- | --- |
| Windows 11 | NVDA + Chrome or Edge | **Untested**; record real spoken labels, heading movement, filter status, focus recovery |
| Windows 11 | JAWS + Chrome or Edge | **Untested**; separate direct speech/navigation observation |
| macOS | VoiceOver + Safari | **Untested**; desktop rotor/keyboard flow |
| iOS | VoiceOver + Safari | **Untested**; touch gestures, picker and focus |
| Android | TalkBack + Chrome | **Untested**; touch exploration, selection and return |
| Linux | Orca + Firefox or Chromium | **Untested**; no available, credible local Orca speech/desktop session |

Capture actual assistive-technology output, commands, interruptions and successful task endpoints with consent; no synthetic speech, DOM/AX tree or axe pass substitutes. Re-run after fixing material defects. A comprehensive WCAG 2.2 AA evaluation remains separate and unclaimed.

## Next research gate

Provision a pinned Kibana environment and verify sample-data/permission parity. Run a moderated pilot, recruit and test 8–12 people, including AT users. Use observations to choose the next UX improvement; evaluate end-to-end authoring and first-time comprehension before broadening backend integrations.
