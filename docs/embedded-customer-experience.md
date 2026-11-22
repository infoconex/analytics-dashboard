# UX-6 — embedded customer experience (evaluation sample)

Tracking: [Issue #38](https://github.com/infoconex/analytics-dashboard/issues/38). **Pre-alpha, sample-data UI evaluation only.** This does not constitute production-ready embedding, a public SDK, customer authentication, tenant provisioning, or a license to redistribute.

> **UX-32 update:** The same-origin sample host now provides an authorized dashboard picker, a second Development-only sample dashboard, host-owned account/Insights Back/Forward, and validated per-dashboard sample filter links. See [UX-32 host navigation](ux32-embedded-host-navigation.md) for current behavior and evidence. The original UX-6 description below records the baseline, not the expanded UX-32 demonstration.

## What a customer sees

`/sample-host.html` is a fictional Northstar Customer Portal. Its **Insights** area contains a labeled, same-origin frame showing `/embed.html#/organization/northstar/dashboard/a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441`. The frame displays the server-authorized dashboard name, purpose, organization and sample-data status; it omits standalone workspace navigation, creation, management, sharing and editing. A consumer can filter, inspect exact data tables and navigate twelve-visualization dashboards, including returning keyboard focus to the corresponding numbered index entry. The standalone `/` route remains intact.

The embedded content has its own skip-to-content control. The host has a skip-to-analytics link, a named iframe and a link after the frame to leave analytics by keyboard. Frames use their own scrolling region; at mobile/narrow reflow the page and frame must each be assessed for overflow separately. The UI uses existing semantic tokens: text, surfaces, borders, selected states and focus. No host-controlled CSS, inline HTML, arbitrary accent color or tenant logo is accepted in this prototype.

## Run the demonstration

1. Follow [README development prerequisites](../README.md): .NET 10, Node 24, npm, and the explicitly enabled development identity in Development only.
2. Start the API, for example `dotnet run --project src/AnalyticsDashboard.Api --urls http://127.0.0.1:5055`.
3. In `web/`, execute `npm ci` then `npm run dev`.
4. Open `http://localhost:5173/sample-host.html`. The host and embed are on **exactly the same origin** (`scheme + hostname + port`). Do not mix `localhost` and `127.0.0.1` as frame origins.
5. Confirm the heading **Business performance**, Northstar organization context and the **Sample data** badge. Use the **Marketing channel** selector, select Direct and then remove that filter. Tab into the frame, use the visualization index where available, then tab back into host navigation.
6. For a standalone view, open `http://localhost:5173/`; for direct sample embed, use the URL in step 4's iframe source. A different dashboard id works only when it actually exists and the authenticated user can view it. The hash is never a login or tenant impersonation mechanism.

Only the development API seed provides Northstar and the sample dashboard. In other environments an authenticated, authorized caller and approved dashboard are required; the demo seed and identity **must not** be enabled in production. A 401/403/404 response is a denial, not a signal to override tenant context. The `Try again` action repeats authorized GETs; it does not elevate privilege.

### Minimal host markup

```html
<a href="#analytics">Skip to analytics</a>
<section id="analytics" aria-label="Customer analytics">
  <iframe
    title="Business performance analytics — Northstar Commerce sample"
    src="/embed.html#/organization/northstar/dashboard/a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441"
    loading="eager"
    referrerpolicy="no-referrer"
    style="display:block; width:100%; height:900px; border:0">
  </iframe>
</section>
<a href="#account">Return to account overview</a>
```

This markup is illustrative. A fixed-height iframe requires scroll testing and may need a host-specific responsive height; there is no automatic resizing protocol. Host developers must preserve a descriptive title, navigation before/after the frame, adequate width, visible focus and accessible error/help context. Do not trap keyboard focus inside the frame or rely on a visual screenshot alone to prove accessibility.

## Integration architecture assessment

| Approach | Benefit | Cost / risk | UX-6 decision |
| --- | --- | --- | --- |
| Separate same-origin iframe page | Isolated application CSS/layout; simple host example; existing API/consumer reuse; native focus into/out of a frame | Host manages height, tab/scroll behavior and matching origin; trusted host shares origin and can script the child | **Selected for sample only** |
| Same-origin routed page without iframe | Smallest deployment and no frame policies | Customer navigates away from their existing page; styling/chrome integration less natural | Available as direct `/embed.html` preview, not host pattern |
| Broader cross-origin iframe | Can be hosted by independent vendor application | Cookies/session policies, federated identity, frame allowlist, `frame-ancestors`, clickjacking, origin-bound commands and lifecycle must be designed | **Security gate required** |
| JS/component SDK | Deepest visual and state integration | Versioned public APIs, styling isolation, auth handoff and ecosystem maintenance | Deferred; demand and contract review first |

## Security and trust boundaries

- The organization ID and dashboard UUID in the hash are **untrusted resource locators**, never authenticated identity, privilege or API authorization data. The embed calls only existing `GET /api/organizations/{organizationId}/dashboards/{id}` and `GET /api/organizations`, and checks the returned organization/id before rendering. API membership checks and scoped repository lookup remain authoritative. There is no new write API, token endpoint, privileged header or data-source runtime activation.
- No arbitrary URL, HTML, color value, CSS, navigation target, iframe command or `postMessage` is accepted. There is **no cross-window message listener**, so an untrusted origin cannot send embed commands. Hash changes are revalidated. In-app filters are ephemeral state; no dashboard updates or persistence.
- A user with an editor/owner role on the standalone API **continues to have that server privilege**. This embedded UI does not display edit/manage affordances but is **not a read-only authorization token or server-enforced viewer role**. A production read-only embed role/authorization model needs separate explicit approval.
- The Vite development/preview server sends `Content-Security-Policy: frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN`. These are **evaluation response headers only**. Actual production hosting must enforce independently reviewed policies on all relevant HTML responses; `frame-ancestors 'self'` would intentionally block independent-origin hosts.
- The same-origin sample trusts its entire host application and all scripts on that origin. A compromised host script can interact with a same-origin child: this is **not** isolation from a hostile host. Production cross-origin hosting must not rely on `sandbox="allow-scripts allow-same-origin"` as a substitute for a trust model; that combination does not provide meaningful isolation when child and parent are same origin.
- Do not put credentials, bearer tokens, signatures, PII or authorization claims in either query strings or fragments. Configure strict HTTPS, federated sign-in/session and cross-site storage separately before production deployment. Host is responsible for trustworthy user sessions, origin policy, retention, event telemetry and secure navigation. No secrets are stored in the demo.
- Clickjacking, cross-origin session acquisition, CSP/frame ancestor allowlisting, tenant identity mapping, host trust, token lifecycle, consent, accessibility across browsing contexts and long-lived deployment/versioning remain **unapproved production gates**. Do not remove sample-only labels or enable live connectors to appear production-ready.

## UX-6 verification and study boundary

`web/e2e/embed.spec.ts` covers: first-arrival host context, filtering/active state, dense navigation and exact focus recovery, keyboard frame transitions, mobile 390×844 and 320×900 reflow, forced colors, empty/error/retry, absence of write/admin controls, sample host onboarding and actual API cross-tenant denial. A separate browser-native zoom test drives Chromium's own `chrome.tabs.setZoom(2/4)` and checks CSS viewport/DPR changes, rather than CSS transforms or merely shrinking the viewport. Save raw Chrome-view captures and machine-readable zoom evidence; inspect images at original resolution. The local `playwright.embed-ui.config.ts` can run UI scenarios against fixed JSON fixtures when .NET is unavailable; it explicitly **skips the real server authorization case**. CI's normal Playwright configuration starts the actual development API and runs it.

Evidence still required for any external usability or WCAG claim:

- Actual visual inspection of every relevant screenshot, per-viewport focus and overflow, including *inside* the iframe; completed automated and manual accessibility audits.
- Genuine speech and navigation output from NVDA/JAWS (Windows), VoiceOver (macOS/iOS), TalkBack (Android), Orca (Linux). DOM assertions, axe and programmatic native zoom do not qualify.
- Representative human task studies with 8–12 consenting consumers and creators, counterbalanced order and parity with a **provisioned** pinned Kibana/Elasticsearch environment. The proposed 9.5.6 comparison baseline remains **unprovisioned**. See [UX-5 study kit](ux5-usability-study.md).
- Security design approval of production framing, IdP integration and tenant/permission model before accepting any real customer embedding or data.

No automated execution or isolated screenshot constitutes observed human superiority over Kibana or a WCAG 2.2 AA conformance claim. UX-7 can focus on organizational permissions and administration clarity without expanding embed authentication implicitly.
