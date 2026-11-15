# UX-2 — dashboard composition

## Creator journey

Organization editors and owners open a dashboard and choose **Edit dashboard**. The canvas gains direct widget manipulation controls and an explicit draft-state indicator. The **Add visualization** tile opens a visual gallery of the six existing chart types, followed by sample dataset, metric and title configuration. Existing widgets retain Edit and Remove controls.

The canvas stores **linear widget order**, using the existing `DashboardDraft.widgets` array as its only layout contract. A pointer user drags a widget handle onto another card to reposition it. Keyboard and touch users use labeled **Move earlier** and **Move later** buttons with disabled boundaries and a polite screen-reader announcement. At narrower widths the two-column canvas becomes one column without changing persisted order.

All edits stay local until **Save changes** succeeds. The editor shows whether changes are pending; Save is unavailable for an unchanged draft or a blank dashboard title. Cancel, internal navigation, browser history navigation and page unload protect unsaved work. A failed or revision-conflicted save leaves the draft intact with an error; the existing API optimistic revision check decides the result. Share remains a pointer protected by server membership, not an authorization grant. Read-only viewers cannot enter composition mode.

Dashboard creation still starts with a name and then enters the same visual editor. An empty dashboard explicitly invites the first visualization. These charts use deterministic built-in samples; customer database connections, queries and provider discovery remain disabled.

## Verification

- Vitest covers moving forwards/backwards, bounds, malformed targets and comparison of changes in title, description and widget fields/order.
- Playwright covers the creator gallery, keyboard ordering with persistence, drag preview, cancel and navigation warnings, an empty responsive canvas, and viewer-only access.
- Required CI retains API NUnit tests, SQL Server/PostgreSQL provider conformance, TypeScript build, security analysis and browser flows.

## Deliberate UX gaps

- Position and span are not separately persisted; no widget resizing, free-form grids, sections or multi-select.
- Pointer handles support mouse and touch; labeled Move buttons and arrow keys on the handle remain keyboard alternatives.
- No undo history beyond Cancel; future UX work can add incremental undo/redo and improved conflict recovery.
- The app-level token system, comprehensive modal/focus audit and WCAG 2.2 AA verification remain UX-4 work.
- Real customer data visualization, consumer filters and embedded customization remain gated follow-on capabilities.
