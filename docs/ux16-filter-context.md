# UX-16 — contextual filter scope and removal (Issue #62)

The product owner found a natural expectation gap: selecting **Organic search**
on **Orders by channel** filtered **Traffic sources** and **Channel details**,
but left **Total revenue**, **Revenue over time**, and **Monthly orders**
unchanged. This is correct for the independent fictional Commerce and Marketing
channel samples: channel-level attribution is not represented in Commerce.
There is no synthetic join and this increment does not add one.

## Reproduce manually (owner, no automated substitute)

Start the local fictional-data stack using `docs/ux16-owner-docker-review.md`.
Open `http://localhost:5173/sample-host.html` (sample-only same-origin host):

1. Reset filters, then select **Organic search** in **Orders by channel**.
2. Inspect **Traffic sources** and **Channel details**: each should show a
   **Filtered** status and a removable **Organic search ×** chip. The donut
   remains the category's usual color. The owner should be able to remove the
   filter directly from either card, without returning to the header.
3. Inspect **Total revenue** and **Revenue over time**: each should explicitly
   say **Not affected** because Commerce has no channel attribution. These
   charts must *not* silently change revenue values.
4. Set Commerce date range to **Final 3 sample months**. Commerce cards now
   show a removable date-range chip; channel cards explain that channel rows
   have no dates. With both filters active, each widget shows the relevant
   one and explains the unrelated one.
5. Focus a card-level × button using Tab, activate with Enter, and verify focus
   returns to the same card heading and the unrelated filter remains intact.
   Reset and repeat inside `/sample-host.html` at narrow width, 200%/400% zoom
   and a Windows contrast theme. Do not claim WCAG conformance.

Automated checks use fixed fictional API fixtures to verify card scopes,
filter-clearing focus and link behavior; they do **not** replace the owner's
hands-on judgment. The established authorization and same-origin embed contracts
are unchanged; there is no persistent filter state or telemetry.

## Findings classification and gates

- **Observed friction:** filter discovery and clearing required finding the
  dashboard-wide control; the owner requested in-place × chips.
- **Expected behavior, not a defect:** a Marketing-channel selection cannot
  filter independent Commerce records or imply nonexistent attribution.
- **Unselected hypothesis:** cross-dataset filtering may become appropriate only
  if the enterprise semantic model later establishes an authorized relationship.
- **Still deferred:** keyboard activation directly on SVG bar/Donut segments,
  advanced chart labels, independent UX research, production embedding, customer
  identity/permissions architecture, telemetry and integrations. These require
  separate scope and, where applicable, explicit security authorization.
