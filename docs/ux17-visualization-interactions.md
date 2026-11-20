# UX-17 — Visualization interaction consistency

Tracking: [Issue #64](https://github.com/infoconex/analytics-dashboard/issues/64).

## Product-owner decisions and provenance

The owner manually completed UX-16 filter checks 4A–4D using the
fictional-data-only Docker review environment. Clearing category and reporting
period selections worked, including their independence. Further observations:

1. Pie/donut hover showed only **Sessions** and a value, omitting the selected
   channel name. **Observed presentation defect**, not an independently conducted
   human usability study.
2. The owner preferred removal in both the always-visible category filter chip
   and the selected item in the expanded **What this means** section. This is a
   product-design preference, not an observed functional failure.
3. The owner explicitly decided that **date range is reporting context** and
   must be changed through the dashboard-level selector, not a removable
   category-filter chip. Applies only to fictional commerce months; the
   independent marketing channel rows have no dates.
4. The owner requested clearer distinction between applied category filters
   and inapplicable categories on unrelated datasets.

## Reproducible owner check

Use `compose.ux16-owner.yml` with a Linux Docker engine, then open
`http://localhost:5173`. Only deterministic fictional records are used.

1. Open **Business performance**. Choose **Final 3 sample months**. Revenue
   cards show Oct–Dec coverage and the reporting period appears in the dashboard
   controls; there is no date filter ×. Change back to all 12 months via the
   native date selector.
2. Hover Referral (red) on **Traffic sources**. Its tooltip identifies
   **Referral · Sessions**, with **2,820** as the formatted value. Verify the
   red color and exact 2,820 in the source table.
3. Choose Referral. Check **Filter applied** and the removable chip on channel
   widgets, **Filter not applied** on commerce widgets, and that Revenue data
   is unchanged. Expand **What this means** in Traffic sources, activate its
   category removal button with Enter, and verify focus returns to the chart
   heading and all five segments reappear.
4. Select both Referral and Final 3 sample months. Clearing Referral leaves
   the commerce period unchanged; switching to All 12 months leaves Referral
   unchanged. Repeat at narrow width, zoom, forced colors and same-origin
   read-only host as appropriate. No production data or telemetry is collected.

## Security and research boundaries

Only client presentation and transient filter controls change. No query joins,
data sources, authorization, memberships, tenant isolation, authentication,
embedding contract, messaging, production integration, or telemetry changes.
Source rows remain unchanged. No WCAG conformance or comparative claims.
Independent research and assistive-technology audits remain outstanding;
production embedding and enterprise permissions require separate authorization.
