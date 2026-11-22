# UX-37 — Visualization repair and authoring recovery

Tracking: [Issue #116](https://github.com/infoconex/analytics-dashboard/issues/116).

## Observed gap
UX-36 already classified fictional sample availability and preserved valid neighboring cards, but unavailable cards lacked a direct editor path. Existing `<select>` elements for saved dataset/metric/scatter axis omitted unsupported legacy selections, leaving an ambiguous blank-looking control. The dashboard already included a navigator/index for eight or more cards; the authoring editor already implemented preview, cancel, widget-array undo/redo, optimistic revision handling and server authorization.

## Focused solution
- Authorized dashboard editors can choose **Review configuration** on an unavailable card while *viewing*. This starts the existing unsaved dashboard composition draft and opens that exact existing widget in the original builder. The user must first apply a valid editor change, then separately save the dashboard. No new persistence or editor subsystem.
- A compact repair summary identifies the known failing configuration and focuses on opening. Unsupported saved dataset, metric, and scatter axis remain explicitly selected in their controls until intentionally replaced. Unsupported chart kinds remain visible by the absence of a selected supported gallery card and the summary. Non-scatter dimensions display the saved field and offer an explicit button to use the supported dimension; it never auto-converts.
- The same fictional data and visualization validation rules gate repair and preview. Unsupported metrics, pie/donut aggregation, unsupported types and dimensions remain unavailable, with no zero substitution. Channel filters yielding no records are separate viewing conditions; they offer only local filter clearing.
- Existing large dashboard navigator and index append **Unavailable** or **No matching records** to entries; there is no competing repair index or bulk change.
- The cancel/success path restores focus and scroll to the affected dashboard heading. Other widget IDs, order, appearance and layout remain in the dashboard draft; widget-array undo/redo is preserved. Existing dashboard revision conflicts continue to block unsafe saves and require explicit latest-revision recovery.
- Viewer/embedded rendering receives no authoring entry. The only authorization boundary remains the existing server authorization/tenant and revision checks; availability is never used to grant rights.

## Deliberate limits
Built-in fictional data is synchronous. There are no source freshness timestamps, per-widget network errors, query retries, data relationships, or production query execution. Save conflicts still require the author to review and manually reapply work. Reload/crash recovery has no browser-side persistence. A repair does not mutate organization library templates or infer source mapping.

## Verification plan and evidence boundaries
Vitest classifies source, metric, incompatible chart, dimension, and unknown kind. Playwright exercises direct repair, unsupported preserved values, preview, cancellation, undo/redo, saved patch with independent siblings, stale revisions, viewer isolation, filter no-match, 1440/768/390/320 layouts, forced colors, and automated axe scans. Full established CI, provider conformance, integration and CodeQL gates remain required. Chromium screenshots need actual inspection from workflow artifacts before claiming visual completion. Automated axe results are **not** manual screen-reader testing, a human usability study, or WCAG conformance. Browser zoom needs separately verifiable zoom testing; CSS reflow is not equivalent.
