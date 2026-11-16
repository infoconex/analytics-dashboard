# UX-4f — Real-environment accessibility verification

Tracking: [Issue #32](https://github.com/infoconex/analytics-dashboard/issues/32). Continues [UX-4e](accessibility-ux4e.md). **Scope: twelve-widget sample dashboard. No WCAG conformance or human usability claim.**

## Baseline observations and focused correction

The UX-4e post-merge [Verify #43808781750](https://github.com/infoconex/analytics-dashboard/actions/runs/43808781750) PNGs were downloaded and inspected. `35-exact-native-table-desktop` shows the indexed dashboard and exact channel values, including Organic search **1,820** and Direct **1,530** orders. `32-chart-insights-reflow-320` shows a single-column, 320 CSS-pixel layout, with horizontally scrollable native tables inside the widget; it does **not** demonstrate native 400% browser zoom. `36-filter-removal-focus-desktop` records the existing filter-focus recovery. These are deterministic scripted captures, not human task observations.

Code inspection identified a specific screen-reader orientation risk: the donut legend button for a selected `Direct` channel had the generic accessible name **Show all channels**. Its visible text was Direct, but its custom `aria-label` obscured that name. The native table's corresponding control already retained the channel identity. UX-4f aligns the donut control's name to **Show all channels instead of Direct**, preserving `aria-pressed=true` until removal. A failing-first render regression and a keyboard browser regression cover this behavior. This is a verified accessible-name change, **not** an observed screen-reader utterance.

## Independent native browser-zoom instrumentation

`web/e2e/visual.spec.ts` now has a separate **browser-native zoom** test using isolated Playwright Chromium, a disposable profile and the inert `web/e2e/zoom-extension/` Manifest V3 service worker. The extension only has the `tabs` permission; it has no content scripts, network calls or effect on production code. Playwright invokes Chrome's own `chrome.tabs.setZoom` and independently reads `chrome.tabs.getZoom` and zoom settings. It cross-checks effective `window.innerWidth`, `devicePixelRatio` and document overflow at 100%, 200% and 400% and captures focused index/filter screenshots, trace and JSON.

This is native browser tab zoom driven by a real browser API, **not** simulated CSS width, CSS `zoom`, CDP device metrics, `Page.setPageScaleFactor`, or a human clicking Chrome's zoom menu. A test only verifies a zoom level when Chrome reports the target factor, automatic zoom handling, and the viewport/DPR changes. The older headless `Control+Equal` attempt stays explicitly identified as an **unsuccessful attempt**, not a pass. The new test exercises the numbered index → widget 12 heading → table and back to exact index entry; channel chart-table values; Direct filter state, label, removal and focus recovery; document overflow and focus within the viewport. UI-only mode can run it without .NET, while full CI verifies it against the same sample dashboard.

Run the sample-only visual scenarios from `web/` with:

```bash
npm ci
npx playwright install chromium
npm run visual:ui-only
```

CI retains the `37-native-zoom-baseline-100`, `38-native-zoom-200/400-index-focus`, `39-native-zoom-200/400-filter-focus`, `native-browser-zoom-evidence.json` and `native-zoom-trace.zip` evidence alongside existing responsive PNGs, WebM and traces for 14 days. Always inspect the actual images and JSON; **do not infer success just from a green test**. A CI browser may differ from an interactive headed OS browser; the remaining interactive gate below is mandatory.

## Actual environment / assistive technology matrix

| Combination | Evidence classification | Status |
| --- | --- | --- |
| Cloud execution host: Debian Linux, Chromium 156 from `/usr/bin/chromium` | Local headless startup | Unavailable: `socket() failed: Operation not permitted` in process singleton; cannot run a local Playwright page |
| Interactive cloud Linux desktop Chromium | Manual browser access | Browser opened; Vite `127.0.0.1:5173` returned `ERR_CONNECTION_REFUSED` because the desktop and code-runner networks are isolated |
| GitHub Actions Ubuntu + Playwright Chromium | Automated native zoom API / keyboard / screenshots | Confirm test outcome from the exact branch Verify run and the JSON artifact before claiming 200% or 400% |
| Windows 11 + Chrome/Edge + NVDA or JAWS | Actual spoken UI / zoom | **Not tested** |
| macOS + Safari + VoiceOver | Actual spoken UI / zoom | **Not tested** |
| iOS + Safari + VoiceOver | Touch screen-reader gestures | **Not tested** |
| Android + Chrome + TalkBack | Touch screen-reader gestures | **Not tested** |
| Linux desktop + Firefox/Chromium + Orca | Actual spoken UI / zoom | **Not tested**: Orca/speech-dispatcher not installed |

No speech audio, assistive-technology timing, actual human task-completion times or participant satisfaction was measured. In particular, an accessibility tree or browser-driven Tab/Enter is **not** a screen reader.

## Reproducible hands-on manual gate

Use a real interactive browser and one of the screen readers above with only the synthetic twelve-widget fixture; never enter customer credentials or enable production providers. Record software version, OS build, browser zoom as shown by the browser's own menu, initial physical browser window size, effective `innerWidth`/`innerHeight` and DPR, keyboard/screen-reader commands, actual spoken wording (or privacy-safe audio), pauses/interruptions/repetition, and exact failures.

1. At 100%, open **Business performance** with twelve widgets; record whether the **Jump to visualization (12)** disclosure is found by heading, landmark or element list.
2. Expand with Enter. Navigate the twelve index items and activate **12. Channel details — regional**. Record whether focus lands on the named heading, whether the screen reader speaks the heading and position, and whether the heading is visually unobscured. Read the exact native table row and column headers, including Direct **1,530**.
3. Use seven keyboard Tabs from the focused heading to reach **Back to visualization list**; activate and verify the exact index entry 12 regains focus. Use Shift+Tab to reach entry 11. Record any unexpected reading order or lost orientation.
4. In **Orders by channel**, determine the highest channel from the visible **At a glance** text (Organic search **1,820** orders), then disclose **View data table** and read its native headers and exact values with the screen reader. In **Traffic sources**, select Direct from the legend and listen for the named pressed-state button; compare its speech to the native data-table action.
5. Set the native **Marketing channel** selector to Direct. Verify visible, spoken and live-region filter state. Focus and activate the transient **Remove Direct filter** button. Verify focus moves to **Marketing channel**, its value returns to **All channels**, and the polite status announcement is delivered without duplicate/conflicting/reordered speech. Record elapsed announcement time from activation and any interruptions.
6. Repeat tasks at a true **200%** and **400%** tab zoom using the browser menu or UI keyboard shortcuts (verify the displayed zoom percentage) with a starting width around 1280 CSS pixels. Record viewport/DPR, whether any document-wide horizontal scrolling is required, scrollable table exceptions, clipping, occluded focus, visible ring, and per-target size/contrast. A 320px responsive viewport alone **does not count**.
7. Repeat at desktop, tablet, mobile and narrow reflow widths. Separate responsive emulation from native OS/browser zoom. Inspect both normal and platform high-contrast modes. Have representative users perform the workflow without prompting; record task success, duration, errors, and subjective usability. Compare with equivalent Kibana tasks only after comparable scenarios and participant controls are established.

For NVDA in browse mode, the documented quick-navigation keys include `H` (headings), `D` (landmarks), `T` (tables), and `NVDA+F7` (elements list). On macOS use the VoiceOver web rotor for headings/tables and document actual commands and speech. For Orca use its structural navigation reference. Confirm commands against the installed version before a study. Include the full screen-reader speech transcript and sequence of live-region events, not merely an accessibility-tree snapshot.

## WCAG 2.2 boundaries

- **1.3.1 / 1.3.2 / 2.4.3 / 4.1.2:** native table relationships, index order, named pressed channel actions and scripted focus restore are covered; actual AT speech/order remains open.
- **1.4.4 / 1.4.10:** native Chromium browser-zoom evidence is a new test path; desktop OS/browser combos and real participant reflow still need manual confirmation. Internal horizontal scrolling for tabular content may be a valid exception; document-wide overflow is separately checked.
- **1.4.3 / 1.4.11 / 2.4.7 / 2.4.11 / 2.5.8:** existing token/axe/forced-colors checks plus scoped screenshots/target checks are not a full contrast, focus obscuration, focus appearance, or target-size inventory. The 24-by-24 CSS-pixel AA target rule includes documented exceptions.
- **2.1.1 / 4.1.3:** keyboard actions and DOM status changes are asserted, but speech latency, screen-reader queuing and touch gestures remain untested.
- WCAG **2.4.13 Focus Appearance is AAA**; do not describe it as AA.

References: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [W3C Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [W3C Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html), [Chrome tabs zoom API](https://developer.chrome.com/docs/extensions/reference/api/tabs), [Playwright Chrome extensions](https://playwright.dev/docs/chrome-extensions), [NVDA user guide](https://download.nvaccess.org/releases/stable/documentation/en/userGuide.html), [Apple VoiceOver rotor](https://support.apple.com/guide/voiceover/voiceover-rotor-mchlp2719/mac), [GNOME Orca structural navigation](https://help.gnome.org/orca/howto_structural_navigation.html).
