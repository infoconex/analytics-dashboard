# UX-7 — Organization experience (sample-data evaluation)

UX-7 keeps the selected organization visible and understandable without introducing an organization-management workflow or weakening the existing authorization boundary.

## Customer journeys

1. Open the standalone application. The sidebar identifies the organization and your role; the top breadcrumb also identifies the active organization. Dashboard and overview headings explicitly reference the organization and sample data.
2. If you belong to multiple organizations, use **Switch organization** in the sidebar. The selected organization becomes part of the hash URL (`#/organization/{id}/overview`, `.../dashboards`, `.../sources`, `.../settings`, `.../explore`). Refresh or browser Back returns to the intended accessible organization. Existing unscoped URLs continue to resolve for backwards compatibility.
3. Open **Organization** for a plain-language explanation of the current viewer/editor/owner capabilities and the metadata-only state of data-source registrations. Creation and editing remain available only in the existing explicitly authorized workflows.
4. If a link names an organization outside your server-returned memberships, the app explains that it cannot use that context and falls back to a permitted organization. No request is issued for an untrusted organization merely because it appears in the URL.
5. In **Data sources**, labels explicitly distinguish metadata registration from a live data connection.

## Trust and architectural boundaries

- Hash organization identifiers are navigation context, **not identity, authentication, or authorization**. Existing server-side membership, role and resource checks remain authoritative. A browser can alter hashes at will.
- Only the existing tenant-scoped dashboard and data-source endpoints are used. No new permissions, cross-origin messages, tokens, credential exchange, production data activation, or public SDK are introduced.
- The URL route grammar accepts identifiers consisting of letters, digits, underscores or hyphens; unknown path shapes and control characters are not interpreted as organization routes. Legacy standalone dashboard hash links remain supported.
- The embed surface (`/embed.html`) and sample host (`/sample-host.html`) remain intentionally unchanged; they already display server-verified organization context. They are sample-only, same-origin UI evaluation, **not production embedding support**.
- Client-hidden authoring controls are discoverability features, not replacements for server-side checks.
- Source-registration status is metadata-only; even registered sources do not feed live visualization data. Production authentication and connectivity require independent design gates.

## Automated verification

- Vitest: scoped navigation generation, backwards-compatible dashboard links, malformed-path rejection.
- Playwright: switching, refresh and browser Back, viewer access, unauthorized organization link recovery, source status, 1440 × 900 / 390 × 844 / 320 × 900, forced colors, genuine Chromium tab zoom 200% and 400% using `chrome.tabs.setZoom`, and raw Chrome screenshots.
- Existing NUnit regression tests reject cross-tenant dashboard GET and unauthorized mutations. Mandatory SQL Server/PostgreSQL conformance is unchanged.
- Actual results belong to the specific GitHub Actions Verify and CodeQL run, not to this test-plan description.

## Remaining evaluation

Automated browser and ARIA checks do not demonstrate spoken-output quality in NVDA, JAWS, VoiceOver, TalkBack, or Orca. Human study participants and a provisioned equivalent Kibana environment are still outstanding. No WCAG 2.2 AA conformance or Kibana-superiority claim is made.
