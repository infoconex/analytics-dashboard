import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, BarChart3, RefreshCw, ShieldCheck } from 'lucide-react';
import { dashboardApi } from './api';
import { DashboardConsumer } from './DashboardConsumer';
import { ApiError, type Dashboard } from './model';
import { formatEmbedTarget, parseEmbedTarget } from './embedRoute';
import { ShareContextDialog } from './ShareContextDialog';
import type { ConsumerFilters } from './consumerFilters';
import type { DashboardWidget } from './model';

type ReadyResult = {
  state: 'ready'; targetKey: string; dashboard: Dashboard; organizationName: string;
  refreshing: boolean;
};
type Result = { state: 'loading' } | { state: 'error'; message: string; retryable: boolean } | ReadyResult;

function loadError(error: unknown): Extract<Result, { state: 'error' }> {
  const status = error instanceof ApiError ? error.status : 0;
  return { state: 'error', retryable: status === 0 || status >= 500,
    message: status === 401 ? 'Your session has expired. Sign in through your customer portal to continue.'
      : status === 403 ? 'You do not have access to this dashboard. Contact your application administrator.'
      : status === 404 ? 'This dashboard could not be found or is no longer available.'
      : 'We could not load this dashboard. Check your connection and try again.' };
}

export function EmbeddedDashboard() {
  const [result, setResult] = useState<Result>({ state: 'loading' });
  const [hash, setHash] = useState(window.location.hash);
  const [attempt, setAttempt] = useState(0);
  const lastReady = useRef<ReadyResult | null>(null);
  const reloadAttempted = useRef(false);
  const reloadButton = useRef<HTMLButtonElement>(null);
  const retryButton = useRef<HTMLButtonElement>(null);
  const errorHeading = useRef<HTMLHeadingElement>(null);
  const [shareRequest, setShareRequest] = useState<{ widget: DashboardWidget; filters: ConsumerFilters } | null>(null);
  const refresh = useCallback(() => { reloadAttempted.current = true; setAttempt(value => value + 1); }, []);
  const target = parseEmbedTarget(hash);
  const targetKey = target ? `${target.organizationId}:${target.dashboardId.toLowerCase()}` : null;
  const preserveFilters = useCallback((filters: ConsumerFilters) => {
    const current = parseEmbedTarget(window.location.hash);
    if (!current) return;
    // Only non-sensitive sample filters go into the locator; never authority.
    window.history.replaceState(window.history.state, '',
      window.location.pathname + formatEmbedTarget({ ...current, filters }));
  }, []);

  useEffect(() => {
    if (!reloadAttempted.current) return;
    if (result.state === 'error') (result.retryable ? retryButton.current : errorHeading.current)?.focus({ preventScroll: true });
    else if (result.state === 'ready' && !result.refreshing) reloadButton.current?.focus({ preventScroll: true });
  }, [result]);

  useEffect(() => {
    const update = () => { setShareRequest(null); setHash(window.location.hash); };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  useEffect(() => {
    let active = true;
    const current = parseEmbedTarget(hash);
    if (!current) {
      lastReady.current = null;
      setResult({ state: 'error', message: 'This dashboard link is invalid. Ask your application administrator for a valid link.', retryable: false });
      return;
    }
    const key = `${current.organizationId}:${current.dashboardId.toLowerCase()}`;
    const previous = lastReady.current?.targetKey === key ? lastReady.current : null;
    if (!previous) lastReady.current = null; // Never reuse a snapshot across dashboard or organization boundaries.
    setResult(previous ? { ...previous, refreshing: true } : { state: 'loading' });
    // Keep the last view only while rechecking. Any failed dashboard lookup must
    // fail closed: organization membership does not grant dashboard permission.
    void Promise.allSettled([
      dashboardApi.find(current.organizationId, current.dashboardId),
      dashboardApi.organizations(),
    ]).then(([dashboardResult, organizationsResult]) => {
      if (!active) return;
      if (organizationsResult.status !== 'fulfilled') {
        lastReady.current = null;
        setResult(loadError(organizationsResult.reason));
        return;
      }
      const organization = organizationsResult.value.find(item => item.id === current.organizationId);
      if (!organization) {
        lastReady.current = null;
        setResult({ state: 'error', message: 'This dashboard is not available to your organization.', retryable: false });
        return;
      }
      if (dashboardResult.status !== 'fulfilled') {
        const error = loadError(dashboardResult.reason);
        lastReady.current = null;
        setResult(error);
        return;
      }
      const dashboard = dashboardResult.value;
      if (dashboard.organizationId !== current.organizationId || dashboard.id.toLowerCase() !== current.dashboardId.toLowerCase()) {
        lastReady.current = null;
        setResult({ state: 'error', message: 'This dashboard is not available to your organization.', retryable: false });
        return;
      }
      const ready: ReadyResult = { state: 'ready', targetKey: key, dashboard, organizationName: organization.name,
        refreshing: false };
      lastReady.current = ready;
      setResult(ready);
    });
    return () => { active = false; };
  }, [attempt, hash]);

  // A route change must not show even one frame of another organization's cached view.
  const visible: Result = result.state === 'ready' && result.targetKey !== targetKey ? { state: 'loading' } : result;

  // The URL cannot turn on creation, editing, admin navigation, or source changes.
  // This is a read-only UI, not a new server-side permission model.
  return <div className="embedded-shell">
    <button type="button" className="skip-link" onClick={() => document.getElementById('embedded-main')?.focus()}>Skip to dashboard content</button>
    <main id="embedded-main" className="embedded-main" tabIndex={-1}>
      {visible.state === 'loading' ? <div className="embedded-status" role="status"><div className="loading-spinner" aria-hidden="true" />Loading customer analytics…</div>
        : visible.state === 'error' ? <section className="embedded-state" aria-labelledby="embedded-error-title">
          <div className="embedded-state-icon"><BarChart3 aria-hidden="true" size={26} /></div>
          <h1 id="embedded-error-title" ref={errorHeading} tabIndex={-1}>Dashboard unavailable</h1>
          <p role="alert">{visible.message}</p>
          {visible.retryable && <button type="button" className="button embedded-retry" ref={retryButton} onClick={refresh}><RefreshCw size={16} aria-hidden="true" /> Try again</button>}
        </section>
        : <>
          <header className="embedded-heading">
            <div className="embedded-heading-mark" aria-hidden="true"><Activity size={22} /></div>
            <div className="embedded-heading-copy">
              <div className="embedded-context">{visible.organizationName} <span aria-hidden="true">/</span> Customer insights</div>
              <h1>{visible.dashboard.name}</h1>
              <p>{visible.dashboard.description || 'Explore your organization’s sample performance at a glance.'}</p>
            </div>
            <div className="embedded-heading-actions">
              <span className="embedded-sample-badge"><ShieldCheck size={15} aria-hidden="true" /> Sample data</span>
              <button type="button" className="button embedded-definition-refresh" ref={reloadButton} aria-disabled={visible.refreshing}
                onClick={() => { if (!visible.refreshing) refresh(); }}>
                <RefreshCw size={15} aria-hidden="true" />
                {visible.refreshing ? 'Checking dashboard…' : 'Reload dashboard definition'}
              </button>
            </div>
          </header>
          <DashboardConsumer key={`${visible.dashboard.organizationId}:${visible.dashboard.id}:${hash}`} widgets={visible.dashboard.widgets}
            initialFilters={parseEmbedTarget(window.location.hash)?.filters ?? target?.filters} onFiltersChange={preserveFilters}
            updatedAt={visible.dashboard.updatedAt} editing={false} canEdit={false} onStartEdit={() => {}} onRepair={() => {}}
            onChange={() => {}} onEdit={() => {}} onAdd={() => {}}
            onAddSaved={() => {}} onDuplicate={() => {}} onSaveToLibrary={() => {}}
            onShareInsight={(widget, filters) => setShareRequest({ widget, filters })} />
          <p className="embedded-footnote">Showing fictional sample data for UI evaluation. Live customer data and production embedding are not enabled.</p>
          {shareRequest && <ShareContextDialog dashboard={visible.dashboard} organizationName={visible.organizationName}
            widget={shareRequest.widget} filters={shareRequest.filters} onDismiss={() => setShareRequest(null)} />}
        </>}
    </main>
  </div>;
}
