import { formatEmbedTarget, parseEmbedTarget } from './embedRoute';
import { defaultConsumerFilters } from './consumerFilters';
import { isHostDashboard, parseHostView, sampleDashboard, sampleOrganization } from './sampleHostRoute';

type HostDashboard = { id: string; name: string; organizationId: string };
const frame = document.querySelector<HTMLIFrameElement>('.host-frame')!;
const frameShell = document.querySelector<HTMLElement>('.host-frame-shell')!;
const insights = document.getElementById('analytics-section')!;
const account = document.getElementById('host-account-panel')!;
const picker = document.getElementById('host-dashboard-picker')!;
const status = document.getElementById('host-status')!;
const retry = document.getElementById('host-retry') as HTMLButtonElement;
const accountLink = document.getElementById('host-account-link')!;
const insightsLink = document.getElementById('host-insights-link')!;
const returnLinks = document.querySelectorAll<HTMLAnchorElement>('.host-return-account');
const savedHashes = new Map<string, string>();

let dashboards: HostDashboard[] = [];
let currentId: string | null = null;
let lastId: string | null = null;
let loaded = false;
let loadError = '';

function snapshotCurrent() {
  if (!currentId) return;
  try {
    // This is an explicitly same-origin demonstration, not cross-origin host
    // communication. Only parse approved NEXA resource locators and filters.
    const parsed = parseEmbedTarget(frame.contentWindow?.location.hash ?? '');
    if (parsed?.organizationId === sampleOrganization && parsed.dashboardId === currentId) {
      savedHashes.set(currentId, formatEmbedTarget(parsed));
    }
  } catch {
    // A cross-origin host cannot inspect a frame and needs an independently
    // reviewed integration protocol; do not weaken the sample's trust model.
  }
}

function showDashboard(dashboard: HostDashboard) {
  const isNew = currentId !== dashboard.id;
  if (isNew) snapshotCurrent();
  const hash = savedHashes.get(dashboard.id) ??
    formatEmbedTarget({ organizationId: sampleOrganization, dashboardId: dashboard.id,
      filters: { ...defaultConsumerFilters } });
  const desired = new URL('/embed.html' + hash, location.href).href;
  frame.title = `${dashboard.name} analytics — Northstar Commerce sample`;
  if (isNew) {
    // Replacing child navigation avoids adding misleading host Back entries.
    // The host URL alone owns account/dashboard navigation history.
    try {
      frame.contentWindow?.location.replace(desired);
    } catch {
      frame.src = desired;
    }
    currentId = dashboard.id;
  }
  lastId = dashboard.id;
  frameShell.hidden = false;
  // Keep the actual anchor nodes stable during navigation: rebuilding the
  // picker after a click would otherwise discard keyboard focus.
  if (picker.childElementCount !== dashboards.length) {
    picker.replaceChildren(...dashboards.map(item => {
      const link = document.createElement('a');
      link.href = `#insights/${encodeURIComponent(item.id)}`;
      link.textContent = item.name;
      link.className = 'host-dashboard-link';
      link.dataset.dashboardId = item.id;
      return link;
    }));
  }
  picker.querySelectorAll<HTMLAnchorElement>('.host-dashboard-link').forEach(link => {
    if (link.dataset.dashboardId === dashboard.id) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  status.textContent = `Viewing ${dashboard.name}. Filters are kept when you switch dashboards or return from Account.`;
}

function render() {
  if (!loaded) return;
  const view = parseHostView(location.hash);
  const isAccount = view?.page === 'account';
  account.hidden = !isAccount;
  insights.hidden = isAccount;
  if (isAccount) {
    accountLink.setAttribute('aria-current', 'page');
    insightsLink.removeAttribute('aria-current');
  } else {
    insightsLink.setAttribute('aria-current', 'page');
    accountLink.removeAttribute('aria-current');
  }
  returnLinks.forEach(link => { link.hidden = isAccount; });
  if (isAccount) {
    status.textContent = 'Account overview. Your embedded analytics view is preserved.';
    return;
  }
  if (loadError) {
    frameShell.hidden = true;
    picker.replaceChildren();
    status.textContent = loadError;
    retry.hidden = false;
    return;
  }
  retry.hidden = true;
  if (!view) {
    frameShell.hidden = true;
    picker.replaceChildren();
    status.textContent = 'This customer portal link is invalid. Choose Insights to return.';
    return;
  }
  const selectedId = view.dashboardId ?? lastId ?? sampleDashboard;
  const dashboard = dashboards.find(item => item.id.toLowerCase() === selectedId.toLowerCase()) ??
    (view.dashboardId === null ? dashboards[0] : undefined);
  if (!dashboard) {
    frameShell.hidden = true;
    picker.replaceChildren();
    status.textContent = 'This dashboard is not available to your account. Choose Insights to see accessible dashboards.';
    return;
  }
  showDashboard(dashboard);
}

async function loadDashboards() {
  loaded = false;
  loadError = '';
  retry.hidden = true;
  status.textContent = 'Loading accessible dashboards…';
  try {
    const response = await fetch(`/api/organizations/${sampleOrganization}/dashboards`, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(response.status === 401
      ? 'Sign in to your customer portal to view dashboards.'
      : response.status === 403 ? 'Your account cannot access these dashboards.'
      : 'Could not load dashboards. Check your connection and try again.');
    const body: unknown = await response.json();
    if (!Array.isArray(body)) throw new Error('Could not load dashboards. Check your connection and try again.');
    dashboards = body.filter(isHostDashboard);
    if (!dashboards.length) throw new Error('No dashboards are available to this account.');
  } catch (error) {
    dashboards = [];
    loadError = error instanceof Error ? error.message : 'Could not load dashboards.';
  }
  loaded = true;
  render();
}

window.addEventListener('hashchange', render);
window.addEventListener('popstate', render);
retry.addEventListener('click', () => { void loadDashboards(); });
void loadDashboards();
