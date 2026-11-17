import { useCallback, useEffect, useState } from 'react';
import { Activity, BarChart3, RefreshCw, ShieldCheck } from 'lucide-react';
import { dashboardApi } from './api';
import { DashboardConsumer } from './DashboardConsumer';
import { ApiError, type Dashboard } from './model';
import { parseEmbedTarget } from './embedRoute';
import { ShareContextDialog } from './ShareContextDialog';
import type { ConsumerFilters } from './consumerFilters';
import type { DashboardWidget } from './model';

type Result = { state: 'loading' } | { state: 'error'; message: string; retryable: boolean } |
  { state: 'ready'; dashboard: Dashboard; organizationName: string };

export function EmbeddedDashboard() {
  const [result, setResult] = useState<Result>({ state: 'loading' });
  const [hash, setHash] = useState(window.location.hash);
  const [attempt, setAttempt] = useState(0);
  const [shareRequest, setShareRequest] = useState<{ widget: DashboardWidget; filters: ConsumerFilters } | null>(null);
  const refresh = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    const update = () => { setShareRequest(null); setHash(window.location.hash); };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  useEffect(() => {
    let active = true;
    const target = parseEmbedTarget(hash);
    if (!target) {
      setResult({ state: 'error', message: 'This dashboard link is invalid. Ask your application administrator for a valid link.', retryable: false });
      return;
    }
    setResult({ state: 'loading' });
    void Promise.all([dashboardApi.find(target.organizationId, target.dashboardId), dashboardApi.organizations()])
      .then(([dashboard, organizations]) => {
        if (!active) return;
        const organization = organizations.find(item => item.id === target.organizationId);
        if (!organization || dashboard.organizationId !== target.organizationId || dashboard.id.toLowerCase() !== target.dashboardId.toLowerCase()) {
          setResult({ state: 'error', message: 'This dashboard is not available to your organization.', retryable: false });
          return;
        }
        setResult({ state: 'ready', dashboard, organizationName: organization.name });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const status = error instanceof ApiError ? error.status : 0;
        setResult({ state: 'error', retryable: status === 0 || status >= 500, message: status === 401 || status === 403 || status === 404
          ? 'This dashboard is unavailable to your account. Contact your application administrator if you need access.'
          : 'We could not load this dashboard. Check your connection and try again.' });
      });
    return () => { active = false; };
  }, [attempt, hash]);

  // The URL cannot turn on creation, editing, admin navigation, or source changes.
  // This is a read-only UI, not a new server-side permission model.
  return <div className="embedded-shell">
    <button type="button" className="skip-link" onClick={() => document.getElementById('embedded-main')?.focus()}>Skip to dashboard content</button>
    <main id="embedded-main" className="embedded-main" tabIndex={-1}>
      {result.state === 'loading' ? <div className="embedded-status" role="status"><div className="loading-spinner" aria-hidden="true" />Loading customer analytics…</div>
        : result.state === 'error' ? <section className="embedded-state" aria-labelledby="embedded-error-title">
          <div className="embedded-state-icon"><BarChart3 aria-hidden="true" size={26} /></div>
          <h1 id="embedded-error-title">Dashboard unavailable</h1>
          <p role="alert">{result.message}</p>
          {result.retryable && <button type="button" className="button embedded-retry" onClick={refresh}><RefreshCw size={16} aria-hidden="true" /> Try again</button>}
        </section>
        : <>
          <header className="embedded-heading">
            <div className="embedded-heading-mark" aria-hidden="true"><Activity size={22} /></div>
            <div className="embedded-heading-copy">
              <div className="embedded-context">{result.organizationName} <span aria-hidden="true">/</span> Customer insights</div>
              <h1>{result.dashboard.name}</h1>
              <p>{result.dashboard.description || 'Explore your organization’s sample performance at a glance.'}</p>
            </div>
            <span className="embedded-sample-badge"><ShieldCheck size={15} aria-hidden="true" /> Sample data</span>
          </header>
          <DashboardConsumer key={`${result.dashboard.organizationId}:${result.dashboard.id}`} widgets={result.dashboard.widgets}
            updatedAt={result.dashboard.updatedAt} editing={false} canEdit={false} onStartEdit={() => {}}
            onChange={() => {}} onEdit={() => {}} onAdd={() => {}}
            onShareInsight={(widget, filters) => setShareRequest({ widget, filters })} />
          <p className="embedded-footnote">Showing fictional sample data for UI evaluation. Live customer data and production embedding are not enabled.</p>
          {shareRequest && <ShareContextDialog dashboard={result.dashboard} organizationName={result.organizationName}
            widget={shareRequest.widget} filters={shareRequest.filters} onDismiss={() => setShareRequest(null)} />}
        </>}
    </main>
  </div>;
}
