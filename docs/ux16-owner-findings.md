# UX-16 product-owner walkthrough — observations and disposition

This is one product owner's hands-on inspection of **fictional data only** on the
local `compose.ux16-owner.yml` demo, not independent customer usability research,
a participant study, or a WCAG conformance claim. Screenshots were provided by
the owner in the UX-16 review conversation; the original independent evaluation
and screenshot methodology remain in `docs/ux13-independent-lab.md` and
`docs/ux12-independent-evaluation.md`.

Key owner-provided screenshot references (ChatGPT personal Library; owner
access may be required): [Referral before filtering](https://chatgpt.com/library?file_id=libfile_eea6bea35340819187a631c931a0ae10&account_id=personal),
[Referral after filtering](https://chatgpt.com/library?file_id=libfile_e5fabafda0a08191ad1e6acf0a3f7ea4&account_id=personal),
[Histogram revenue buckets](https://chatgpt.com/library?file_id=libfile_dab75147ed348191b984bbe3635ea27e&account_id=personal),
and [Scatter and source records](https://chatgpt.com/library?file_id=libfile_3a32d834be208191b3c3a4f5f81646b8&account_id=personal).
The original measurement review package is linked from
`docs/ux15-expanded-visualizations.md`; these screenshots supplement it.

## Reproduce

From a clean `main` checkout on Docker Desktop's Linux engine:

```powershell
docker compose -f compose.ux16-owner.yml config --quiet
docker compose -f compose.ux16-owner.yml up -d
```

Open `http://localhost:5173` for authoring or
`http://localhost:5173/sample-host.html` for the supported **same-origin,
read-only sample embed**. Follow `docs/ux16-owner-docker-review.md`; do not
activate live data, external origins, or authentication integrations.

For the color defect: in the sample host's **Traffic sources** Donut, note the
red **Referral** slice and legend marker. Select Referral. Before this increment
the single remaining slice and legend became blue. It must remain red after
filtering and after refresh. For value formatting: preview Commerce **Revenue**
Pie/Donut, Line/Bar, Histogram, and Scatter. Compare tooltip, axis, frequency
and bucket labels with the exact source table (`$18,400`, etc.). Histogram
vertical counts must not become dollars.

## Owner observations and classifications

| ID | Evidence and observation | Classification | Suggested priority |
| --- | --- | --- | --- |
| F01 | Suggested visualization title required manual clearing | Product-owner friction; inspect default versus placeholder | P3 |
| F02 | Walkthrough requested independent X/Y controls not present for ordinary line charts | **Walkthrough instruction mismatch**; advanced-axis configuration unselected | No defect |
| F03 | Pie/Donut month sequence seemed counterclockwise, January away from 12 o'clock | Owner observation; confirm orientation in browser before change | P2 |
| F04 | Currency symbols and grouping missing from hover labels; histogram bucket labels lacked `$` | Owner observation and screenshot-confirmed histogram formatting inconsistency | **P2, selected here** |
| F05 | Scatter axes lacked visible `Orders` / `Revenue (USD)` titles | Screenshot and owner preference | P3 |
| F06 | Explore allows creation of a *new* dashboard but not selection of an existing authorized dashboard | Confirmed existing-workflow gap; owner wants both choices | P2, separate increment |
| F07 | Channel filter affected only Marketing channels, not independent Commerce performance; local clear action would help | **Expected sample data scope**, plus discoverability/refinement hypothesis | P2, separate increment |
| F08 | Referral red in full Donut became blue when filtered; legend changed with it | **Screenshot-confirmed product defect** | **P2, selected here** |
| F09 | Owner wants optional Pie/Donut labels with leader lines, auto-limited for collisions | Subjective product enhancement; not a defect | P2, separate increment |
| F10 | Bar/Donut shapes not keyboard-operable; alternate category controls provided filtering | Accessibility/usability observation; scope and alternatives need audit | P2, separate increment |

Additional improvement hypothesis: an empty title disabled **Update
visualization**, and the owner successfully recovered; inline clarification may
help but there was no observed failed task.

Owner completed manual creation, preview, edit, cancel, save, reload, revisit,
ordering and all nine kinds (metric, line, area, bar, donut, table, pie,
histogram, scatter). Sample host navigation, source data, filters and read-only
experience worked. A ~400px window, 200%/400% zoom and Windows contrast theme
were reported usable with no horizontal overflow. No recordings, recruitment,
participant data or persistent telemetry were collected.

## Ranked next increments after this change

1. F07 contextual filter state/clear affordance and F10 keyboard affordances,
   while preserving dataset separation and server permissions.
2. F03 chronological pie/donut ordering and F09 optional collision-aware labels.
3. F06 add Explore insight to an existing **authorized same-organization**
   dashboard, preserving server ownership checks.
4. F05 explicit scatter axis titles and F01 title-field polish.

## Outstanding gates

- No independent human task study or broad usability effectiveness claim.
- No WCAG conformance assertion; additional assistive-tech review and manual
  inspection of focus and forced colors remain prudent.
- Production embedding, identity federation, organization hierarchy/permissions
  design, integrations, telemetry and cross-origin contracts remain deferred and
  require separate security and product authorization.
- No production customer data or live data sources are part of this increment.
