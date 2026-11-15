import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, BarChart3, Bell, BookOpen,
  CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, Clock3,
  Cloud, Database, Ellipsis, ExternalLink, FileBarChart, Filter, FolderKanban,
  Gauge, LayoutDashboard, LockKeyhole, Menu, MoreHorizontal, Plus, Search,
  Settings2, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Trash2,
  TrendingUp, Users, X,
} from 'lucide-react';
import { dashboardApi } from './api';
import { createWidget, datasetOptions, dimensions, metrics, visualizations } from './demoData';
import type { CurrentIdentity, Dashboard, DashboardDraft, DashboardWidget, DatasetKey, Membership, WidgetKind } from './model';
import { WidgetTile } from './WidgetTile';
import { DataSourcesPage } from './DataSourcesPage';

type Page = 'overview' | 'dashboards' | 'sources' | 'settings';
type View = { page: Page; id?: string; organizationId?: string };

function currentView(): View {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith('/organization/')) {
    const parts = hash.split('/');
    if (parts.length === 5 && parts[3] === 'dashboard') {
      return { page: 'dashboards', organizationId: decodeURIComponent(parts[2] ?? ''), id: parts[4] };
    }
  }
  if (hash.startsWith('/dashboard/')) return { page: 'dashboards', id: hash.slice('/dashboard/'.length) };
  if (hash === '/sources') return { page: 'sources' };
  if (hash === '/settings') return { page: 'settings' };
  if (hash === '/dashboards') return { page: 'dashboards' };
  return { page: 'overview' };
}

const emptyDraft = (): DashboardDraft => ({ name: '', description: '', widgets: [] });

export default function App() {
  const [view, setView] = useState<View>(currentView);
  const [organizations, setOrganizations] = useState<Membership[]>([]);
  const [identity, setIdentity] = useState<CurrentIdentity | null>(null);
  const [organizationId, setOrganizationId] = useState('');
  const [dashboardList, setDashboardList] = useState<{ organizationId: string; items: Dashboard[] } | null>(null);
  const loadVersion = useRef(0);
  const activeOrganization = useRef(organizationId);
  activeOrganization.current = organizationId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('12m');
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<DashboardDraft | null>(null);
  const [widgetDraft, setWidgetDraft] = useState<DashboardWidget | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const organization = organizations.find(item => item.id === organizationId);
  const canEdit = organization?.role === 'owner' || organization?.role === 'editor';
  const dashboards = dashboardList?.organizationId === organizationId ? dashboardList.items : [];
  const activeDashboard = dashboards.find(item => item.id === view.id);

  useEffect(() => {
    const handleHash = () => {
      const next = currentView();
      setView(next);
      if (next.organizationId && organizations.some(item => item.id === next.organizationId)) {
        setOrganizationId(next.organizationId);
      }
      setEditMode(false);
      setDraft(null);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [organizations]);

  useEffect(() => {
    Promise.all([dashboardApi.organizations(), dashboardApi.identity()]).then(([items, user]) => {
      setOrganizations(items);
      setIdentity(user);
      setOrganizationId(previous => previous || items.find(item => item.id === currentView().organizationId)?.id || items[0]?.id || '');
      if (items.length === 0) setLoading(false);
    }).catch(exception => { setError(exception.message); setLoading(false); });
  }, []);

  const loadDashboards = useCallback(async () => {
    if (!organizationId) return;
    const requestVersion = ++loadVersion.current;
    setLoading(true);
    try {
      const items = await dashboardApi.list(organizationId);
      if (requestVersion !== loadVersion.current) return;
      setDashboardList({ organizationId, items });
      setError('');
    } catch (exception) {
      if (requestVersion !== loadVersion.current) return;
      setError(exception instanceof Error ? exception.message : 'Unable to load dashboards.');
    } finally {
      if (requestVersion === loadVersion.current) setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadDashboards();
    return () => { loadVersion.current++; };
  }, [loadDashboards]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function navigate(next: Page, id?: string) {
    window.location.hash = id ? `/organization/${encodeURIComponent(organizationId)}/dashboard/${id}` : next === 'overview' ? '/' : `/${next}`;
    setView({ page: next, id });
    setEditMode(false);
    setDraft(null);
    setSidebarOpen(false);
  }

  async function createDashboard() {
    if (!draft || !organizationId) return;
    const targetOrganizationId = organizationId;
    try {
      const created = await dashboardApi.create(targetOrganizationId, draft);
      if (activeOrganization.current !== targetOrganizationId) return;
      setDashboardList(current => current?.organizationId === targetOrganizationId
        ? { ...current, items: [created, ...current.items] } : current);
      setCreateOpen(false);
      setDraft(null);
      setToast('Dashboard created');
      navigate('dashboards', created.id);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Unable to create dashboard.');
    }
  }

  async function saveDashboard() {
    if (!draft || !activeDashboard) return;
    const targetOrganizationId = organizationId;
    try {
      const updated = await dashboardApi.update(targetOrganizationId, activeDashboard, draft);
      if (activeOrganization.current !== targetOrganizationId) return;
      setDashboardList(current => current?.organizationId === targetOrganizationId
        ? { ...current, items: current.items.map(item => item.id === updated.id ? updated : item) } : current);
      setDraft(null);
      setEditMode(false);
      setToast('All changes saved');
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Unable to save dashboard.');
    }
  }

  async function removeDashboard(dashboard: Dashboard) {
    if (!window.confirm(`Delete "${dashboard.name}"? This cannot be undone.`)) return;
    const targetOrganizationId = organizationId;
    try {
      await dashboardApi.remove(targetOrganizationId, dashboard.id);
      if (activeOrganization.current !== targetOrganizationId) return;
      setDashboardList(current => current?.organizationId === targetOrganizationId
        ? { ...current, items: current.items.filter(item => item.id !== dashboard.id) } : current);
      if (view.id === dashboard.id) navigate('dashboards');
      setToast('Dashboard deleted');
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Unable to delete dashboard.');
    }
  }

  async function share(dashboard: Dashboard) {
    const url = `${window.location.origin}${window.location.pathname}#/organization/${encodeURIComponent(dashboard.organizationId)}/dashboard/${dashboard.id}`;
    try { await navigator.clipboard.writeText(url); setToast('Dashboard link copied'); }
    catch { setToast(`Link: ${url}`); }
  }

  const preview = editMode && draft && activeDashboard
    ? { ...activeDashboard, ...draft } : activeDashboard;
  const featured = dashboards[0];
  const filtered = dashboards.filter(item =>
    `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <button className="brand" onClick={() => navigate('overview')} aria-label="Analytics Dashboard home">
          <div className="brand-mark"><Activity size={23} strokeWidth={2.4} /></div>
          <div><span className="brand-name">nexa<span>.</span></span><span className="brand-subtitle">ANALYTICS STUDIO</span></div>
        </button>

        <div className="workspace-switch">
          <div className="workspace-avatar">{organization?.name?.charAt(0) ?? 'N'}</div>
          <div className="workspace-details"><strong>{organization?.name ?? 'Your workspace'}</strong><small>{organization?.role ?? 'Organization'}</small></div>
          <ChevronDown size={14} />
          {organizations.length > 1 && <select aria-label="Switch organization" value={organizationId} onChange={event => { setOrganizationId(event.target.value); navigate('overview'); }}>
            {organizations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>}
        </div>

        <div className="sidebar-navigation">
          <span className="nav-caption">WORKSPACE</span>
          <NavButton active={view.page === 'overview'} label="Overview" onClick={() => navigate('overview')} icon={<Gauge size={18} />} />
          <NavButton active={view.page === 'dashboards'} label="Dashboards" onClick={() => navigate('dashboards')} icon={<LayoutDashboard size={18} />} count={dashboards.length} />
          <NavButton active={view.page === 'sources'} label="Data sources" onClick={() => navigate('sources')} icon={<Database size={18} />} />
          <div className="sidebar-divider" />
          <span className="nav-caption">MANAGEMENT</span>
          <NavButton active={view.page === 'settings'} label="Organization" onClick={() => navigate('settings')} icon={<Users size={18} />} />
          <NavButton active={false} label="Security" onClick={() => navigate('settings')} icon={<ShieldCheck size={18} />} />
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-tip"><div className="sidebar-tip-icon"><Sparkles size={17} /></div><strong>Insights, simplified.</strong><p>Build a clearer picture of your data with visual dashboards.</p></div>
          <div className="sidebar-profile"><div className="profile-avatar">{identity?.displayName.slice(0, 2).toUpperCase() ?? 'US'}</div><div><strong>{identity?.displayName ?? 'Signed-in user'}</strong><small>{organization?.name ?? 'Workspace'}</small></div><Ellipsis size={19} /></div>
        </div>
      </aside>

      <div className="main-layout">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
            <span className="crumb-root">Workspace</span><ChevronRight size={15} />
            <span className="crumb-current">{view.id ? activeDashboard?.name ?? 'Dashboard' : view.page === 'overview' ? 'Overview' : view.page === 'sources' ? 'Data sources' : view.page === 'settings' ? 'Organization' : 'Dashboards'}</span>
          </div>
          <div className="topbar-actions">
            <span className="demo-label"><span /> DEMO DATA</span>
            <button className="icon-button topbar-icon" aria-label="Help" title="Documentation is in the repository" onClick={() => navigate('settings')}><CircleHelp size={19} /></button>
            <button className="icon-button topbar-icon" aria-label="Notifications" title="No notifications"><Bell size={19} /></button>
            <div className="topbar-user">{identity?.displayName.slice(0, 2).toUpperCase() ?? 'US'}</div>
          </div>
        </header>

        <main className="main-content">
          {error && <div role="alert" className="error-banner"><span>{error}</span><button onClick={() => { setError(''); void loadDashboards(); }}><X size={17} /></button></div>}
          {loading ? <div className="loading-state"><div className="loading-spinner" /> Loading workspace…</div>
            : organizations.length === 0 ? <EmptyState title="No organizations available" message="Your identity has no assigned organization. Ask your platform administrator for access." />
            : view.page === 'sources' ? <DataSourcesPage key={organizationId} organizationId={organizationId} canEdit={canEdit} onNotice={setToast} />
            : view.page === 'settings' ? <SettingsPage organization={organization} />
            : view.id ? preview ? (
              <>
                <div className="page-heading dashboard-heading">
                  <div className="heading-left"><button className="back-button" aria-label="Back to dashboards" onClick={() => navigate('dashboards')}><ArrowLeft size={20} /></button>
                    <div><div className="eyebrow">DASHBOARD <span>·</span> {editMode ? 'EDITING' : 'OVERVIEW'}</div>
                      {editMode && draft ? <input className="title-edit" aria-label="Dashboard name" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /> : <h1>{preview.name}</h1>}
                      {editMode && draft ? <input className="description-edit" aria-label="Dashboard description" value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /> : <p>{preview.description}</p>}</div>
                  </div>
                  <div className="heading-actions">
                    {editMode ? <><button className="button button-quiet" onClick={() => { setEditMode(false); setDraft(null); }}>Cancel</button><button className="button button-primary" onClick={() => void saveDashboard()}><Check size={16} /> Save changes</button></>
                      : <><button className="button button-light" onClick={() => void share(preview)}><Share2 size={16} /> Share</button>{canEdit && <button className="button button-primary" onClick={() => { setDraft({ name: preview.name, description: preview.description, widgets: preview.widgets.map(item => ({ ...item })) }); setEditMode(true); }}><SlidersHorizontal size={16} /> Edit dashboard</button>}</>}
                  </div>
                </div>
                <div className="dashboard-toolbar"><div className="toolbar-left"><span className="live-indicator"><span /> Sample dataset</span><span className="toolbar-separator" /><span className="toolbar-muted"><Clock3 size={15} /> Updated {new Date(preview.updatedAt).toLocaleDateString()}</span></div><PeriodPicker period={period} setPeriod={setPeriod} /></div>
                <div className="widgets-grid">{preview.widgets.map(widget => <WidgetTile key={widget.id} widget={widget} period={period} editing={editMode} onEdit={setWidgetDraft} onRemove={id => setDraft(current => current ? { ...current, widgets: current.widgets.filter(item => item.id !== id) } : current)} />)}
                  {editMode && <button className="add-widget" onClick={() => setWidgetDraft(createWidget())}><span><Plus size={25} /></span><strong>Add visualization</strong><small>Choose a visualization and data series</small></button>}</div>
              </>
            ) : <EmptyState title="Dashboard not found" message="This dashboard may have been deleted or is not in your organization." />
            : view.page === 'dashboards' ? (
              <>
                <div className="page-heading"><div><div className="eyebrow">YOUR WORKSPACE</div><h1>Dashboards</h1><p>Explore insights and keep your entire team on the same page.</p></div>{canEdit && <button className="button button-primary" onClick={() => { setDraft(emptyDraft()); setCreateOpen(true); }}><Plus size={18} /> New dashboard</button>}</div>
                <div className="list-toolbar"><div className="list-search"><Search size={18} /><input aria-label="Search dashboards" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search dashboards..." /></div><div className="list-count"><LayoutDashboard size={16} /> {filtered.length} dashboards</div></div>
                <div className="dashboard-cards">{filtered.map((item, index) => <article key={item.id} className="dashboard-card"><button className={`dashboard-thumbnail thumbnail-${index % 3}`} onClick={() => navigate('dashboards', item.id)} aria-label={`Open ${item.name}`}><div className="thumbnail-bars">{[38, 62, 48, 82, 68, 95, 75, 100, 80, 92, 71, 98].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div><div className="thumbnail-float"><TrendingUp size={14} /> +24.8%</div></button><div className="dashboard-card-body"><div className="dashboard-card-title"><h3>{item.name}</h3><button className="icon-button" aria-label={`Share ${item.name}`} title="Copy share link" onClick={() => void share(item)}><Share2 size={16} /></button></div><p>{item.description || 'Your custom analytics workspace.'}</p><div className="card-footer"><span><FileBarChart size={15} /> {item.widgets.length} visuals</span><button onClick={() => navigate('dashboards', item.id)}>View dashboard <ArrowRight size={14} /></button></div></div></article>)}
                  {canEdit && <button className="new-dashboard-card" onClick={() => { setDraft(emptyDraft()); setCreateOpen(true); }}><div><Plus size={26} /></div><strong>Create new dashboard</strong><p>Bring your data together in a new view.</p></button>}</div>
                {filtered.length === 0 && !canEdit && <EmptyState title="No dashboards found" message="Try another search, or ask an editor to create a dashboard." />}
                {canEdit && filtered.length > 0 && <section className="manage-section"><h2>Manage dashboards</h2><p>Editors can remove dashboards. All organization members can view and share dashboard links.</p><div>{filtered.map(item => <div className="manage-row" key={item.id}><span>{item.name}</span><button className="icon-button danger-hover" onClick={() => void removeDashboard(item)} title={`Delete ${item.name}`} aria-label={`Delete ${item.name}`}><Trash2 size={16} /></button></div>)}</div></section>}
              </>
            ) : <>
              <div className="page-heading overview-heading"><div><div className="eyebrow">YOUR ANALYTICS AT A GLANCE <span className="eyebrow-dot" /></div><h1>Welcome back, {identity?.displayName.split(' ')[0] ?? 'there'} <span className="wave">✳</span></h1><p>Here's what's happening across your workspace today.</p></div>{canEdit && <button className="button button-primary" onClick={() => { setDraft(emptyDraft()); setCreateOpen(true); }}><Plus size={18} /> New dashboard</button>}</div>
              <div className="summary-row"><SummaryCard icon={<BarChart3 size={20} />} title="Total revenue" value="$375.3K" trend="+24.8%" color="blue" /><SummaryCard icon={<FolderKanban size={20} />} title="Total orders" value="7,891" trend="+18.2%" color="violet" /><SummaryCard icon={<Users size={20} />} title="New customers" value="5,014" trend="+12.6%" color="mint" /><SummaryCard icon={<Activity size={20} />} title="Conversion rate" value="4.82%" trend="+2.1%" color="peach" /></div>
              <div className="section-title-row"><div><h2>Performance overview</h2><p>Your key metrics, all in one place.</p></div><PeriodPicker period={period} setPeriod={setPeriod} /></div>
              <div className="overview-charts"><WidgetTile widget={{ id: 'overview-revenue', title: 'Revenue trends', kind: 'area', datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'month' }} period={period} /><WidgetTile widget={{ id: 'overview-sources', title: 'Traffic by channel', kind: 'donut', datasetKey: 'channels', metricKey: 'sessions', dimensionKey: 'channel' }} period={period} /></div>
              <div className="section-title-row recent-header"><div><h2>Recent dashboards</h2><p>Jump back into what you've been working on.</p></div><button className="text-link" onClick={() => navigate('dashboards')}>View all <ArrowRight size={16} /></button></div>
              <div className="recent-list">{dashboards.slice(0, 4).map(item => <button key={item.id} className="recent-item" onClick={() => navigate('dashboards', item.id)}><span className="recent-icon"><LayoutDashboard size={20} /></span><span className="recent-text"><strong>{item.name}</strong><small>{item.widgets.length} visualizations · Updated {new Date(item.updatedAt).toLocaleDateString()}</small></span><ChevronRight size={18} /></button>)}{!featured && <div className="recent-empty">No dashboards yet. Create your first dashboard to get started.</div>}</div>
              <div className="sample-footnote"><ShieldCheck size={16} /> This workspace uses clearly labeled sample data. Configure real data sources in a future increment.</div>
            </>}
        </main>
      </div>

      {toast && <div className="toast"><Check size={16} />{toast}</div>}
      {createOpen && draft && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setCreateOpen(false); }}><section className="modal" role="dialog" aria-modal="true" aria-label="Create dashboard"><div className="modal-heading"><div><span className="eyebrow">NEW WORKSPACE VIEW</span><h2>Create dashboard</h2><p>Give your dashboard a name. Add visualizations after creating it.</p></div><button className="icon-button" aria-label="Close" onClick={() => setCreateOpen(false)}><X size={20} /></button></div><label className="form-label">Dashboard name<input autoFocus maxLength={100} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Customer health overview" /></label><label className="form-label">Description<textarea maxLength={500} rows={3} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="What would you like your team to learn from this view?" /></label><div className="modal-actions"><button className="button button-light" onClick={() => setCreateOpen(false)}>Cancel</button><button className="button button-primary" disabled={!draft.name.trim()} onClick={() => void createDashboard()}>Create dashboard <ArrowRight size={16} /></button></div></section></div>}

      {widgetDraft && editMode && draft && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setWidgetDraft(null); }}><section className="modal" role="dialog" aria-modal="true" aria-label="Configure visualization"><div className="modal-heading"><div><span className="eyebrow">VISUALIZATION BUILDER</span><h2>Configure visualization</h2><p>Choose how you'd like to present your sample data.</p></div><button className="icon-button" aria-label="Close" onClick={() => setWidgetDraft(null)}><X size={20} /></button></div>
        <label className="form-label">Title<input maxLength={100} value={widgetDraft.title} onChange={event => setWidgetDraft({ ...widgetDraft, title: event.target.value })} /></label>
        <div className="form-grid"><label className="form-label">Chart type<select value={widgetDraft.kind} onChange={event => setWidgetDraft({ ...widgetDraft, kind: event.target.value as WidgetKind })}>{visualizations.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label className="form-label">Dataset<select value={widgetDraft.datasetKey} onChange={event => { const datasetKey = event.target.value as DatasetKey; setWidgetDraft({ ...widgetDraft, datasetKey, metricKey: metrics[datasetKey][0]?.key ?? 'orders', dimensionKey: dimensions[datasetKey] }); }}>{datasetOptions.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label></div>
        <label className="form-label">Metric<select value={widgetDraft.metricKey} onChange={event => setWidgetDraft({ ...widgetDraft, metricKey: event.target.value })}>{(metrics[widgetDraft.datasetKey] ?? []).map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        <div className="modal-actions"><button className="button button-light" onClick={() => setWidgetDraft(null)}>Cancel</button><button className="button button-primary" disabled={!widgetDraft.title.trim()} onClick={() => { setDraft({ ...draft, widgets: draft.widgets.some(item => item.id === widgetDraft.id) ? draft.widgets.map(item => item.id === widgetDraft.id ? widgetDraft : item) : [...draft.widgets, widgetDraft] }); setWidgetDraft(null); }}><Check size={16} /> Add to dashboard</button></div></section></div>}
    </div>
  );
}

function NavButton({ active, label, icon, onClick, count }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void; count?: number }) {
  return <button className={`nav-button ${active ? 'nav-active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{count !== undefined && <small>{count}</small>}</button>;
}

function PeriodPicker({ period, setPeriod }: { period: string; setPeriod: (period: string) => void }) {
  return <div className="period-picker"><CalendarDays size={16} /><select aria-label="Period" value={period} onChange={event => setPeriod(event.target.value)}><option value="3m">Last 3 months</option><option value="6m">Last 6 months</option><option value="12m">Last 12 months</option></select><ChevronDown size={14} /></div>;
}

function SummaryCard({ icon, title, value, trend, color }: { icon: React.ReactNode; title: string; value: string; trend: string; color: string }) {
  return <div className="summary-card"><div className="summary-top"><div className={`summary-icon icon-${color}`}>{icon}</div><MoreHorizontal size={19} className="muted-icon" /></div><div className="summary-title">{title}</div><div className="summary-value">{value}</div><div className="summary-bottom"><span className="positive-trend"><TrendingUp size={13} /> {trend}</span><span>vs. previous year</span></div></div>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="empty-state"><div><LayoutDashboard size={30} /></div><h2>{title}</h2><p>{message}</p></div>;
}

function SettingsPage({ organization }: { organization?: Membership }) {
  return <><div className="page-heading"><div><div className="eyebrow">ADMINISTRATION</div><h1>Organization</h1><p>Manage your workspace and understand the current access model.</p></div></div><div className="settings-card"><div className="settings-card-icon"><Users size={22} /></div><div><h2>{organization?.name ?? 'Organization'}</h2><p>Organization ID: <code>{organization?.id}</code></p><span className="role-pill"><ShieldCheck size={14} /> {organization?.role ?? 'member'}</span></div></div><div className="settings-grid"><article className="settings-section"><div className="settings-title"><LockKeyhole size={21} /><h3>Identity & access</h3></div><p>Every dashboard and data-source registration operation is validated against organization membership and role permissions on the server.</p><div className="settings-detail"><span>Authorization</span><strong>Organization-scoped RBAC</strong></div><div className="settings-detail"><span>Production authentication</span><strong>OIDC / JWT required</strong></div></article><article className="settings-section"><div className="settings-title"><Database size={21} /><h3>Workspace data</h3></div><p>Dashboard and data-source registration metadata is persisted to SQLite. Data-source registration has revision-safe rename and removal.</p><div className="settings-detail"><span>Data-source definitions</span><strong>Metadata only</strong></div><div className="settings-detail"><span>Live connections</span><strong>Not available</strong></div></article></div><div className="sample-footnote"><BookOpen size={16} /> Detailed architecture, limitations, and setup instructions live in the repository README.</div></>;
}
