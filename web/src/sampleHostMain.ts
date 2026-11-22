import { formatEmbedTarget, parseEmbedTarget } from './embedRoute';
import { defaultConsumerFilters } from './consumerFilters';
import { isHostDashboard, parseHostView, sampleDashboard, sampleOrganization } from './sampleHostRoute';

type HostDashboard = { id: string; name: string; organizationId: string };
const frame = document.querySelector<HTMLIFrameElement>('.host-frame')!;
const frameShell = document.querySelector<HTMLElement>('.host-frame-shell')!;
const frameLoading = document.getElementById('host-frame-loading')!;
const insights = document.getElementById('analytics-section')!;
const account = document.getElementById('host-account-panel')!;
const accountHeading = document.getElementById('host-account-heading') as HTMLHeadingElement;
const introduction = document.getElementById('account-summary')!;
const afterAnalytics = document.querySelector<HTMLElement>('.host-exit')!;
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
let lastRenderedPage: 'account' | 'insights' | null = null;

// Same-tab, fictional view preferences only. Stored locators are revalidated
// and never grant access: the authorized dashboard collection is fetched first.
const snapshotKey = 'nexa.sample-host.view-filters.v1';
function restoreSnapshots() {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(snapshotKey) ?? 'null');
    if (!Array.isArray(stored)) return;
    for (const entry of stored.slice(0, 20)) {
      if (!Array.isArray(entry) || entry.length !== 2 ||
          typeof entry[0] !== 'string' || typeof entry[1] !== 'string') continue;
      const target = parseEmbedTarget(entry[1]);
      if (target?.organizationId === sampleOrganization && target.dashboardId === entry[0]) {
        savedHashes.set(entry[0], formatEmbedTarget(target));
      }
    }
  } catch {
    // Storage can be denied or corrupted; fall back to default view filters.
  }
}
function persistSnapshots() {
  try {
    sessionStorage.setItem(snapshotKey, JSON.stringify([...savedHashes].slice(-20)));
  } catch {
    // Storage is an optional convenience, not an authorization dependency.
  }
}

let frameObserver: ResizeObserver | null = null;
let observedChild: Document | null = null;
let measureQueued = false;

// Content sizing is deliberately restricted to this same-origin example.
// A production cross-origin embed needs a separately reviewed protocol.
function measureFrame() {
  if (frameShell.hidden || !currentId) return;
  try {
    const child = frame.contentDocument;
    if (child?.location.origin !== location.origin || child.location.pathname !== '/embed.html') return;
    const shell = child.querySelector<HTMLElement>('.embedded-shell');
    if (!shell) return;
    // Measure the content rather than the child's viewport: the latter may
    // still reflect the previous (much taller) dashboard after a switch.
    const height = Math.ceil(Math.max(shell.scrollHeight, shell.getBoundingClientRect().height)) + 1;
    if (height > 1 && frame.style.height !== `${height}px`) frame.style.height = `${height}px`;
    // Native modal dialogs otherwise center in a many-screen-tall iframe.
    // These CSS-only viewport hints are available solely to this sample host.
    const bounds = frame.getBoundingClientRect();
    const visibleTop = Math.max(0, Math.min(bounds.height, -bounds.top));
    const visibleBottom = Math.max(visibleTop, Math.min(bounds.height, innerHeight - bounds.top));
    child.documentElement.classList.add('same-origin-sample-host');
    child.documentElement.style.setProperty('--host-visible-top', `${visibleTop}px`);
    child.documentElement.style.setProperty('--host-visible-height', `${visibleBottom - visibleTop}px`);
    frameLoading.hidden = true;
    frameShell.setAttribute('aria-busy', 'false');
  } catch {
    // Never read cross-origin content or assume it can be auto-sized.
  }
}
function scheduleFrameMeasure() {
  if (measureQueued) return;
  measureQueued = true;
  requestAnimationFrame(() => {
    measureQueued = false;
    measureFrame();
  });
}
function observeFrame() {
  frameObserver?.disconnect();
  frameObserver = null;
  observedChild?.removeEventListener('change', snapshotCurrent);
  observedChild?.removeEventListener('click', snapshotCurrent);
  observedChild = null;
  try {
    const child = frame.contentDocument;
    if (child?.location.origin !== location.origin || child.location.pathname !== '/embed.html') return;
    const shell = child.querySelector<HTMLElement>('.embedded-shell');
    if (!shell) return;
    frameObserver = new ResizeObserver(scheduleFrameMeasure);
    frameObserver.observe(shell);
    // Same-origin sample events capture approved filters before reload.
    observedChild = child;
    child.addEventListener('change', snapshotCurrent);
    child.addEventListener('click', snapshotCurrent);
    scheduleFrameMeasure();
  } catch {
    // This sample does not implement cross-origin frame communication.
  }
}

function snapshotCurrent() {
  if (!currentId) return;
  try {
    // This is an explicitly same-origin demonstration, not cross-origin host
    // communication. Only parse approved NEXA resource locators and filters.
    const parsed = parseEmbedTarget(frame.contentWindow?.location.hash ?? '');
    if (parsed?.organizationId === sampleOrganization && parsed.dashboardId === currentId) {
      savedHashes.set(currentId, formatEmbedTarget(parsed));
      persistSnapshots();
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
    frameObserver?.disconnect();
    observedChild?.removeEventListener('change', snapshotCurrent);
    observedChild?.removeEventListener('click', snapshotCurrent);
    observedChild = null;
    frameLoading.hidden = false;
    frameShell.setAttribute('aria-busy', 'true');
    // Navigate only AFTER an authorized list, always replacing child
    // history (including the first about:blank navigation).
    try {
      if (!frame.contentWindow) throw new Error('Frame not initialized');
      frame.contentWindow.location.replace(desired);
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
  // Hash navigation can blur a link before hashchange fires; derive focus
  // recovery from the host view transition, not document.activeElement.
  const nextPage = isAccount ? 'account' : 'insights';
  const pageChanged = lastRenderedPage !== null && lastRenderedPage !== nextPage;
  lastRenderedPage = nextPage;
  account.hidden = !isAccount;
  introduction.hidden = isAccount;
  insights.hidden = isAccount;
  afterAnalytics.hidden = isAccount;
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
    // Returning from a link that is now hidden must not leave keyboard
    // focus on the document body or inside an inaccessible frame.
    if (pageChanged) accountHeading.focus();
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
  // The account return link disappears on navigation. Place focus on the
  // authorized dashboard choice without disturbing focus in the host header.
  if (pageChanged) picker.querySelector<HTMLAnchorElement>('[aria-current="page"]')?.focus();
}

async function loadDashboards() {
  loaded = false;
  loadError = '';
  frameShell.hidden = true;
  frameObserver?.disconnect();
  observedChild?.removeEventListener('change', snapshotCurrent);
  observedChild?.removeEventListener('click', snapshotCurrent);
  observedChild = null;
  frameLoading.hidden = false;
  frameShell.setAttribute('aria-busy', 'true');
  frame.src = 'about:blank';
  currentId = null;
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
    const permitted = new Set(dashboards.map(item => item.id));
    for (const id of savedHashes.keys()) {
      if (!permitted.has(id)) savedHashes.delete(id);
    }
    persistSnapshots();
  } catch (error) {
    dashboards = [];
    loadError = error instanceof Error ? error.message : 'Could not load dashboards.';
  }
  loaded = true;
  render();
}

// The host controls its own history. Intercept only its known navigation links
// so native same-page anchor focusing cannot steal focus back after a view
// transition hides the original anchor target. Modifier clicks remain native.
document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey
      || event.altKey || event.shiftKey) return;
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
  if (!link || !link.matches('.host-nav a, .host-dashboard-link, .host-return-account, #host-account-panel a, .host-exit a')) return;
  const destination = link.getAttribute('href');
  if (!destination || !parseHostView(destination)) return;
  event.preventDefault();
  if (window.location.hash !== destination) {
    window.history.pushState(window.history.state, '', destination);
  }
  render();
  if (destination === '#analytics-section' && lastRenderedPage === 'insights') {
    insights.scrollIntoView({ block: 'start' });
  }
});
frame.addEventListener('load', observeFrame);
window.addEventListener('resize', scheduleFrameMeasure);
window.addEventListener('scroll', scheduleFrameMeasure, { passive: true });
window.visualViewport?.addEventListener('resize', scheduleFrameMeasure);
// pagehide runs before a normal reload and while the same-origin child URL
// still holds its latest filters (updated via history.replaceState).
window.addEventListener('pagehide', snapshotCurrent);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') snapshotCurrent();
});
restoreSnapshots();
window.addEventListener('hashchange', render);
window.addEventListener('popstate', render);
retry.addEventListener('click', () => { void loadDashboards(); });
void loadDashboards();
