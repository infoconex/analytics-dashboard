# UX-4g — Measured control affordance and usability-study readiness

Tracking: [Issue #34](https://github.com/infoconex/analytics-dashboard/issues/34). Continues [UX-4f](accessibility-ux4f.md). **Scope:** sample-only, twelve-widget UI. **No claim of complete WCAG 2.2 AA conformance, human usability results or actual screen-reader speech.**

## Observed baseline and correction

Reviewed UX-4f's [desktop consumption, mobile/dialog and genuine native-zoom Chrome-view images](https://github.com/infoconex/analytics-dashboard/actions/runs/43813329132/artifacts/14201381835). These establish actual painted UI states, including an unobscured recovered filter focus ring at 400% native zoom. They do not establish every control's target size or color contrast.

The existing semantic `--color-border` is a subtle **decorative** divider. Applied to essential input edges, it makes the only visible field boundary difficult to distinguish. Independently calculated opaque sRGB colors show:

| Pair / purpose | Before | After | Decision |
| --- | ---: | ---: | --- |
| Input edge vs white `#fff` | `#dce4f0`, **1.28:1** | `#7b8ba4`, **3.46:1** | Stronger border specifically on inputs and button-like controls; leave decorative card borders subtle |
| Input edge vs muted surface `#f1f4fb` | **1.16:1** (calculated) | **3.14:1** | Maintain non-text difference on both common surfaces |
| Keyboard focus ring vs dark navigation `#101828` | `#3156d3`, **2.88:1** | `#c4d2ff`, **11.84:1** | Scope a contrasting ring to dark navigation while retaining the blue ring on light surfaces |
| Selected donut outline/border vs white | Former border `#8ea2ed`, **2.46:1** | `#657cca` border, **3.97:1**; existing primary outline retained | Keep selected state distinguishable by shape, boundary and `aria-pressed`, without relying on chart color |
| Normal focus ring vs white | `#3156d3`, **6.17:1** | Unchanged | Existing focus indicator already contrasted with the light surface |

These numbers describe specified pairs, not every rendered composite. Borders required to identify controls are assessed using WCAG 1.4.11's 3:1 criterion; purely decorative boundaries need not meet it. Text requires 4.5:1 in ordinary sizes and 3:1 for qualifying large text under 1.4.3. Disabled/inactive control appearance and user-agent-drawn elements have applicable exceptions. **2.4.13 Focus Appearance is AAA, not AA**. Focus visibility 2.4.7 and Focus Not Obscured (Minimum) 2.4.11 remain AA.

The stronger border is applied to form inputs, filter selects, search and period controls, light/back/reset buttons and donut selection buttons. The selected filter chip receives its own boundary. System colors take precedence in `forced-colors: active`. No accessibility treatment should depend solely on these token ratios.

## Browser measurement inventory and evidence

`web/e2e/controlAudit.ts` collects **computed browser** foreground/background color and border ratios, painted ancestor backgrounds, size/position, selected/disabled state, name/role approximations, outline geometry and nearby target centers from visible interactive HTML controls. The browser emits a machine-readable `ux4g-rendered-control-inventory.json` for desktop, selected Direct, tablet, mobile, 320px reflow, open editing dialog and forced colors. Playwright also saves `40–45-ux4g-*.png` before/after-focused screenshots. The existing genuine Chrome-tab-zoom test appends 200% and 400% control measurements to `native-browser-zoom-evidence.json` and retains **raw Chrome-view** focus screenshots, since its ordinary Playwright zoom clips can be inaccurate.

| Control family | States/targets to evaluate | Accessibility risks and verification |
| --- | --- | --- |
| Navigation and skip link | Keyboard focus, active item, mobile overlay, hidden sidebar | Visible high-contrast focus, order, obscuration and inertness |
| Dashboard actions | Share/edit/back; disabled Save; create/delete; overflow-free header | Essential boundaries, 24px minimum or exception, disclosure and focus after modal dismissal |
| Filtering | Date/channel selects; reset; removable chips | 3:1 necessary field edges, selected/removed state, polite status, focus restored unobscured |
| Dense index | Disclosure; twelve jump buttons; return action | 44px jump rows, exact heading/index focus and sticky-header clearance |
| Chart/table alternatives | Legend buttons, inline table filters, table disclosures and scroll regions | 24px targets or documented exceptions; native row/column headers, selected state and exact values |
| Editing modal | Close, visualization choices, form inputs, Cancel/Add | Focus trap, initial focus, disabled actions, 320px scroll and focus visibility |
| Errors/forced colors | Dismiss/retry, system foreground/background/Highlight | Visual affordance, focus geometry, status announcements; verify real operating-system modes separately |

### Interpretation limitations

- Inventory `name` and `role` fields are DOM approximations, **not** browser accessibility-tree or spoken names. Selected workflows also use Playwright's role/name queries and axe to detect accessible markup regressions.
- Color computation composites solid CSS ancestor backgrounds. Gradients, image backgrounds, antialiasing, translucent overlay effects, pseudo-elements and semantic importance of particular graphical edges require human inspection. The inventory flags gradient backgrounds; it cannot certify every pixel or all text nodes. In forced-colors mode, system-defined color outcomes should be inspected visually; do not misinterpret CSS token pair ratios as the user's chosen high-contrast palette.
- A target meets WCAG 2.5.8 AA at **24×24 CSS px**, or under one of its precise exceptions (including sufficient spacing). Small targets receive 24px-centered-circle proximity diagnostics for manual exception review. **44×44 is the enhanced AAA 2.5.5 threshold**, not the 2.5.8 AA minimum. Inline text links, user-agent controls, equivalence and essential presentation have separate exceptions. Do not label every undersized element a conformance failure without checking its exception.
- Focus geometry checks the viewport and sticky header; screenshots are needed to see clipping by other overlays/scroll containers. Browser automation at 320 CSS pixels is **not** browser-native 400% zoom. Native tab-zoom factor, DPR, viewport width and raw painted image must all agree.

## Reproducible human screen-reader verification gate (untested)

Use the exact UX-4f [manual procedure](accessibility-ux4f.md#reproducible-hands-on-manual-gate) and capture actual speech, interruption timing, heading/table navigation and exact filter announcements. Separate test participants and platform combinations rather than assuming one screen reader represents another:

| Environment | Required combination | Current status |
| --- | --- | --- |
| Windows 11 | NVDA + Chrome/Edge; JAWS + Chrome/Edge | **Untested**: no reliable real speech environment |
| macOS | VoiceOver + Safari | **Untested** |
| iOS | VoiceOver + Safari gestures | **Untested** |
| Android | TalkBack + Chrome gestures | **Untested** |
| Linux | Orca + Firefox/Chromium | **Untested**: local shell cannot launch Chromium; Orca speech not available |

Real OS screen reader + browser interaction is the authoritative method. Accessibility-tree snapshots, the Chrome DevTools Accessibility pane, axe/Playwright and synthetic speech are useful diagnostics **but not substitutes**. Feasible execution choices:

- **No new service:** run free [NVDA](https://www.nvaccess.org/download/) on a real Windows 11 computer, platform VoiceOver on macOS/iOS, TalkBack on Android, or [GNOME Orca](https://help.gnome.org/orca/) on a graphical Linux desktop. Record direct spoken output and user commands. A local headless Chromium worker cannot supply this evidence.
- **Optional external testing service (not purchased or configured):** [BrowserStack Live documents real NVDA on Windows and VoiceOver on macOS](https://www.browserstack.com/docs/live/accessibility-testing/screenreader-desktop); [its accessibility service documents TalkBack on Android](https://www.browserstack.com/docs/accessibility/overview/introduction), and [screen-reader automation for NVDA/VoiceOver](https://www.browserstack.com/docs/accessibility/screen-reader-launcher/screen-reader-automation) can capture output. Verify specific device/browser combinations and audio quality before accepting evidence. Such a service does not eliminate the need for representative people.

No connected real desktop or paid remote service provided reliable screen-reader speech in this increment. Reject a platform as tested when no genuine interaction or spoken-output evidence is produced.

## Practical, comparable UX study: Analytics Dashboard versus Kibana

**Status: protocol only; zero human measurements.** Recruit 8–12 representatives across dashboard consumers and creators, including keyboard-only and real screen-reader users; record expertise, device, and software. Use equivalent fictitious data, comparable dashboard configuration and permissions. Provide the same task wording, start/end conditions and reference numbers. Do not compare an instrumented sample dashboard against Kibana production ingest/administration tasks not implemented here.

1. **Orient and navigate.** Find visualization 12 from the dashboard overview; return to its exact index entry. Success: correct card and index, no assistance.
2. **Interpret a chart.** Identify the highest-order channel and value without interpreting bar height alone. Success: *Organic search, 1,820 orders*; demonstrate native table access.
3. **Filter and recover.** Filter to Direct, verify selected state and **1,530 orders**, remove it, identify return of all channels. Success: data changes and focus does not disappear.
4. **Edit and cancel.** Open editor and Add visualization modal, inspect choices, cancel, and return to the previous control. Success: no accidental save, accessible focus and meaningful orientation.
5. **Mobile or high zoom.** Open navigation, access a chart and its table at 320 CSS pixels, then independently at genuine 200%/400% browser zoom. Success: no document-wide horizontal scroll, no obscured focused actions; independently scrollable wide tables may be justified.

For *each task and participant*, record task result (complete/partial/failed), time from instruction to correct endpoint, wrong selections, backtracks and keyboard Tab count / screen-reader navigation steps, assistance count and script, orientation-loss moments, barrier severity and verbatim explanation. After each task ask 1–7 perceived-clarity and ease ratings; after the session ask a short preference explanation. Capture anonymous IDs, not personal/customer data. Log interruptions and participant resets; never silently remove failed trials.

Use a **counterbalanced within-subject** sequence: half begin with Analytics Dashboard and half with Kibana; rotate task order, allow matched training, use the same hardware/browser/AT mode and data, and include a short rest period. Prefer a known Kibana version and document feature parity and any non-equivalent tasks. Analyze completion percentages, median and interquartile completion times, errors, assistance, orientation loss and clarity *per tool*, segmented by assistive-technology cohort; report sample counts and uncertainty. A claim of being "better than Kibana" requires observed evidence, not these proposed targets.

## Next gate

Inspect the actual CI JSON plus raw snapshots at 1440, 768, 390, 320 CSS px and native 200%/400%; verify both CodeQL languages and full Verify before squash merge. Obtain representative people with real assistive technology to confirm spoken navigation and task outcomes before declaring accessibility readiness or product superiority.

Authoritative references: [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/), [Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html), [Focus Appearance AAA](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html), [W3C usability testing](https://www.w3.org/WAI/test-evaluate/involving-users/).
