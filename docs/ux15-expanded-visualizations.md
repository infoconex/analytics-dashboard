# UX-15 — Expanded fictional visualizations and previewable authoring

Tracking: [Issue #56](https://github.com/infoconex/analytics-dashboard/issues/56). Product principle: **simple by default, powerful when needed**. This is a creator-oriented, sample-data increment, not a reproduction of Kibana Lens and not a comparative usability evaluation.

## Implemented visualization choices

| Choice | Meaning and source rows | Limits |
| --- | --- | --- |
| Metric | One described measure; existing sample interpretation rules | Distinct-channel conversion percentages cannot be added as one rate. |
| Area / line | Fictional Jan–Dec commerce observations | Month labels have no specific year. Do not call changes year-over-year. |
| Bar | Compare actual months or fictional marketing channels | Channel categories are not an ordered time series. |
| Donut / pie | Parts of a total when the measure is additive (for example, session or order counts by channel) | Reject conversion-rate slices: independent sample percentages do **not** define shares of a total. A selected channel is only a conditional filtered view, not a new total across all channels. |
| Histogram | Deterministic four-bin frequency distribution of one numeric field; one count per original fictional month or channel | Count means *sample rows in value ranges*, not order/customer counts. Constant observations use one bin. No dates or extra source records are invented. |
| Scatter | Paired numeric horizontal and vertical measures from the **same** original month/channel record, with separate axis selectors | Original rows are retained. Correlation, causation and statistical significance are not asserted. Duplicate measures and nonnumeric horizontal axes are rejected. |
| Table | Exact individual rows under native column and row headers | Source is static fictional sample, not customer analytics. |

The fictional source arrays in `web/src/demoData.ts` remain unchanged: twelve month observations with `revenue/orders/customers`, and five independent channel observations with `orders/sessions/conversion`. `visualizationSemantics.ts` computes derived histogram bins directly from these rows and checks meaning before rendering; it does not persist derived data or connect to a real source. A source table below each chart remains independently inspectable, including both scatter axes. The meaning/provenance disclosure remains available. We made no inference about deduplicated customers across months.

**UX-13 fixture manifest revision:** Expanding the chart-choice list in `demoData.ts` changes that source file's byte-level SHA-256 even though the fictional arrays are identical. The reviewed `lab/ux13/fixtures/manifest.json` therefore records the new whole-file SHA-256 `6316f43c4b3b0bd06c9a71d6bd7e3c1d5a62241b1a7aa6e7a4cc0e062a8c11b7`. The three generated payload SHA-256 values and all exact source rows remain unchanged; `npm run test:lab` verifies this byte-for-byte. Historical UX-13/UX-14 documents retain their original captured-run source SHA; they describe those earlier runs, not a newly captured lab result.

## Creator walkthrough for the product owner

Requires the existing development API and Vite web app. Visit `http://localhost:5173` using only development sample data:

1. In **Explore**, choose a sample measure and a new chart type. For scatter, choose a second numeric measure and inspect its exact same-row table. A non-additive conversion-rate pie/donut is blocked here too. You may create a dashboard from a valid Explore preview.
2. Alternatively, choose **New dashboard**; name it and choose **Create dashboard**. This starts an empty saved definition.
3. Choose **Edit dashboard**, then **Add visualization**. Select **Pie chart**. Pick *Marketing channels* and *Orders*; inspect the live preview and expand **View data table** to verify `Organic search → 1,820` and `Direct → 1,530`.
4. Select *Conversion rate* on the pie. A visible error must explain why the percentages cannot be summed; **Add to dashboard** is disabled. Choose *Sessions* or *Orders* to recover.
5. Add a **Histogram** of commerce *Revenue*; note the chart means counts of 12 observed monthly sample rows distributed into four value ranges.
6. Add a **Scatter plot** of commerce *Orders* versus *Revenue* (or *Customers*). Change both axis selectors and expand the exact data table to check same-row pairs.
7. Add/update a descriptive title. Finish **Add to dashboard**; use keyboard move controls to reorder; **Save changes**, reload and revisit.
8. Re-enter **Edit dashboard** and **Edit [visualization title]**. Change its title, kind or measures. Confirm **Update visualization**, then **Save changes**; reload. Also try **Cancel** to verify unsaved draft is discarded.
9. Review at desktop, mobile, narrow viewport, keyboard, and forced colors. Check that a *viewer* sees consumption, not authoring controls. In the same-origin sample embed the new kinds are rendered read-only.

This is an owner walkthrough, **not** recruitment or a human usability study. Take qualitative notes about discoverability, terminology, editor scrolling and preview usefulness. There is no participant-data collection or telemetry.

## Test and screenshot reproduction

Production builds and unit checks:

```sh
cd web
npm ci
npm run build
npm test -- --run
```

The standard `npm run test:e2e`/repository `scripts/verify.ps1 -IncludeBrowserTests` requires the local .NET API and runs all Playwright tests. In a host with Chromium but without the .NET SDK, the new **optional** fictional-data-only browser walkthrough can run using:

```sh
cd web
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx playwright test -c playwright.visualizations.config.ts
```

This starts Vite and uses a deterministic, in-memory, request-intercepted fictional API with no back-end data writes. Its Playwright attachments include original desktop pie/histogram/scatter previews, saved view, invalid-rate recovery, 390×844 and 320×900 editor reflow, forced-colors focus state, and browser/viewport/DPR/focus measurements. The standard CI `Verify` browser job remains authoritative if the execution environment prohibits Chromium subprocess sockets. Screenshot automation is **not** a real screen-reader assessment, a zoom audit, WCAG conformance, or a task-completion measure.

## Deferrals and boundaries

- Gauge and stacked charts require meaningful goal thresholds or component/time-series semantics absent from the existing fixtures. Heatmaps, maps, treemaps, multi-axis charts, arbitrary transformations, live data and chart customization need separate evidence and scoping.
- No change to organization hierarchy, tenant isolation, roles, customer authentication, production connections, embedding contracts, cross-origin messages or sample-data interpretation.
- No claim that Kibana workflows are task-equivalent, that one product is more usable, or that independent research was completed. The UX-12/13/14 parity and consent gates remain unchanged.
- Product vision, including future enterprise parent/child organizations and fine-grained permissions, remains deferred to its separate documented discussion. This increment is about visualization creation and inspection.

## Follow-on review

After this implementation is merged and deployable to a developer-owned preview, run the product owner's **manual visualization/dashboard UI review** (first-time create, edit, save/cancel, recover, inspect, narrow layouts) before opening another feature increment. Treat any findings as hypotheses until reproduced and classified. Independent customer studies, production provisioning and security/integration contract changes remain gated separately.
