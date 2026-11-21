import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, BarChart3, BookOpen,
  CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp,
  Cloud, Database, Ellipsis, ExternalLink, FileBarChart, Filter, FolderKanban,
  Gauge, LayoutDashboard, LockKeyhole, Menu, Plus, Search,
  Settings2, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Trash2,
  Users,
} from 'lucide-react';
import { dashboardApi } from './api';
import { hasDashboardChanges } from './composition';
import { createWidget, datasetOptions, dimensions, formatDetailedMetric, formatMetric, metrics, selectRows } from './demoData';
import { sampleOverview, type OverviewMetric } from './sampleInterpretation';
import type { CurrentIdentity, Dashboard, DashboardDraft, DashboardWidget, DatasetKey, Membership, WidgetKind } from './model';
import { DashboardConsumer } from './DashboardConsumer';
import { WidgetTile } from './WidgetTile';
import { DataSourcesPage } from './DataSourcesPage';
import { ExplorePage } from './ExplorePage';
import { VisualizationGallery } from './VisualizationGallery';
import { Button } from './ui/Button';
import { ModalDialog } from './ui/ModalDialog';
import { isSupportedAppHash, organizationHash, parseOrganizationHash } from './organizationRoute';
import { businessQuestions, findQuestionMatches, type QuestionMatch } from './dashboardDiscovery';
import { DashboardStartingPoints } from './DashboardStartingPoints';
import { DashboardTaskGuide } from './DashboardTaskGuide';
import { ShareContextDialog } from './ShareContextDialog';
import { defaultConsumerFilters } from './consumerFilters';
import type { ConsumerFilters } from './consumerFilters';
import { suggestedDimension, visualizationProblem } from './visualizationSemantics';
import { chartAppearance, compatibleAppearance, layoutForChangedKind, withAppearance } from './visualizationAppearance';

type Page = 'overview' | 'explore' | 'dashboards' | 'sources' | 'settings';
type View = { page: Page; id?: string; organizationId?: string };

function currentView(): View {
  const hash = window.location.hash.slice(1);
  const scoped = parseOrganizationHash(window.location.hash);
  if (scoped) return scoped;
  if (hash.startsWith('/dashboard/')) return { page: 'dashboards', id: hash.slice('/dashboard/'.length) };
  if (hash === '/explore') return { page: 'explore' };
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
  const [dashboardLoadFailed, setDashboardLoadFailed] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [questionFilter, setQuestionFilter] = useState('');
  const [selectedTask, setSelectedTask] = useState<{ organizationId: string; dashboardId: string; questionId: string; widgetId: string } | null>(null);
  const [period, setPeriod] = useState('12m');
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<DashboardDraft | null>(null);
  const [widgetDraft, setWidgetDraft] = useState<DashboardWidget | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [createError, setCreateError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [organizationNotice, setOrganizationNotice] = useState('');
  const [shareRequest, setShareRequest] = useState<{ dashboard: Dashboard; organizationName: string; filters: ConsumerFilters; widget?: DashboardWidget } | null>(null);
  const viewingSnapshot = useRef<{ key: string; filters: ConsumerFilters } | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const mainContent = useRef<HTMLElement>(null);
  const skipNextHashPrompt = useRef(false);
  const acceptedHash = useRef(window.location.hash);
  const focusOnNavigation = useRef(false);

  const organization = organizations.find(item => item.id === organizationId);
  const canEdit = organization?.role === 'owner' || organization?.role === 'editor';
  const dashboards = dashboardList?.organizationId === organizationId ? dashboardList.items : [];
  const activeDashboard = dashboards.find(item => item.id === view.id);
  const hasChanges = Boolean(editMode && draft && activeDashboard && hasDashboardChanges(draft, activeDashboard));

  useEffect(() => { if (createOpen) setCreateError(''); }, [createOpen]);

  // Discovery is ephemeral consumer context, never persisted across tenants.
  useEffect(() => { setSearch(''); setQuestionFilter(''); setSelectedTask(null); }, [organizationId]);

  useEffect(() => {
    if (sidebarOpen) sidebar.current?.querySelector<HTMLButtonElement>('.nav-button')?.focus();
  }, [sidebarOpen]);

  function closeSidebar() {
    setSidebarOpen(false);
    window.requestAnimationFrame(() => menuButton.current?.focus());
  }

  function confirmDiscard(): boolean {
    return !hasChanges || window.confirm('Discard your unsaved dashboard changes?');
  }

  function stopEditing() {
    if (!confirmDiscard()) return;
    setEditMode(false);
    setDraft(null);
    setWidgetDraft(null);
    setSaveError('');
  }

  function startEditing(openGallery = false) {
    if (!canEdit || !activeDashboard) return;
    setDraft({ name: activeDashboard.name, description: activeDashboard.description,
      widgets: activeDashboard.widgets.map(item => ({ ...item })) });
    setSaveError('');
    setEditMode(true);
    if (openGallery) setWidgetDraft(createWidget());
  }

  useEffect(() => {
    const handleHash = () => {
      const internalNavigation = skipNextHashPrompt.current;
      if (!internalNavigation && !confirmDiscard()) {
        window.history.replaceState(null, '', acceptedHash.current || '#/');
        return;
      }
      skipNextHashPrompt.current = false;
      acceptedHash.current = window.location.hash;
      focusOnNavigation.current = true;
      const next = currentView();
      viewingSnapshot.current = null;
      setShareRequest(null);
      if (!internalNavigation) setSelectedTask(null);
      setView(next);
      if (!isSupportedAppHash(window.location.hash) && organizations.length > 0) {
        const fallbackId = organizations.some(item => item.id === activeOrganization.current)
          ? activeOrganization.current : organizations[0]!.id;
        setOrganizationNotice('The requested destination is invalid. Showing an authorized workspace.');
        window.history.replaceState(null, '', organizationHash(fallbackId, 'overview'));
        acceptedHash.current = window.location.hash;
        setOrganizationId(fallbackId);
        setView({ page: 'overview' });
      } else if (next.organizationId) {
        if (organizations.some(item => item.id === next.organizationId)) {
          setOrganizationId(next.organizationId);
          setOrganizationNotice('');
        } else if (organizations.length > 0) {
          setOrganizationNotice('The requested organization is unavailable to your account. Showing an authorized workspace.');
          window.history.replaceState(null, '', organizationHash(organizations[0]!.id, 'overview'));
          acceptedHash.current = window.location.hash;
          setOrganizationId(organizations[0]!.id);
          setView({ page: 'overview' });
        }
      }
      setEditMode(false);
      setDraft(null);
      setWidgetDraft(null);
      setSaveError('');
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [organizations, hasChanges]);

  // Navigation replaces the previous control; place keyboard focus on the new
  // page heading instead of leaving it on a detached element. The question
  // guide owns focus when a customer explicitly chose a business question.
  useEffect(() => {
    if (!focusOnNavigation.current || loading) return;
    if (selectedTask?.organizationId === organizationId && selectedTask.dashboardId === view.id) {
      focusOnNavigation.current = false;
      return;
    }
    const heading = mainContent.current?.querySelector<HTMLElement>('.page-heading h1, .empty-state h2, .embedded-state h1');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    focusOnNavigation.current = false;
  }, [view, loading, selectedTask, organizationId, dashboardLoadFailed]);

  useEffect(() => {
    if (!hasChanges) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasChanges]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const [items, user] = await Promise.all([dashboardApi.organizations(), dashboardApi.identity()]);
      setOrganizations(items);
      setIdentity(user);
      const requestedId = currentView().organizationId;
      const invalidDestination = !isSupportedAppHash(window.location.hash);
      const selectedId = items.find(item => item.id === requestedId)?.id || items[0]?.id || '';
      setOrganizationId(selectedId);
      if (requestedId && requestedId !== selectedId && selectedId) {
        focusOnNavigation.current = true;
        setOrganizationNotice('The requested organization is unavailable to your account. Showing an authorized workspace.');
        window.history.replaceState(null, '', organizationHash(selectedId, 'overview'));
        acceptedHash.current = window.location.hash;
        setView({ page: 'overview' });
      } else if (invalidDestination && selectedId) {
        focusOnNavigation.current = true;
        setOrganizationNotice('The requested destination is invalid. Showing an authorized workspace.');
        window.history.replaceState(null, '', organizationHash(selectedId, 'overview'));
        acceptedHash.current = window.location.hash;
        setView({ page: 'overview' });
      }
      // A late identity response must not erase a newer dashboard-list failure.
      setError(previous => previous.startsWith('We could not check dashboards.') ? previous : '');
      if (items.length === 0) setLoading(false);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Unable to load your workspace.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const loadDashboards = useCallback(async () => {
    if (!organizationId) return;
    const requestVersion = ++loadVersion.current;
    setLoading(true);
    setDashboardLoadFailed(false);
    setError('');
    try {
      const items = await dashboardApi.list(organizationId);
      if (requestVersion !== loadVersion.current) return;
      setDashboardLoadFailed(false);
      setDashboardList({ organizationId, items });
      setError('');
    } catch (exception) {
      if (requestVersion !== loadVersion.current) return;
      // A failed refresh must not masquerade as an empty catalog or continue
      // displaying previously fetched content after possible access revocation.
      setDashboardList(null);
      setDashboardLoadFailed(true);
      viewingSnapshot.current = null;
      setSelectedTask(null);
      setShareRequest(null);
      // Backend errors may include HTTP internals and do not establish that
      // there are zero dashboards or that access has permanently changed.
      setError('We could not check dashboards. Retry to load an authorized view.');
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

  function navigate(next: Page, id?: string, nextOrganizationId = organizationId) {
    if (!confirmDiscard()) return;
    if (!organizations.some(item => item.id === nextOrganizationId)) return;
    const nextHash = organizationHash(nextOrganizationId, next, id);
    focusOnNavigation.current = true;
    skipNextHashPrompt.current = window.location.hash !== nextHash;
    window.location.hash = nextHash;
    acceptedHash.current = window.location.hash;
    if (nextOrganizationId !== organizationId) setOrganizationId(nextOrganizationId);
    setOrganizationNotice('');
    setView({ page: next, id });
    setEditMode(false);
    setDraft(null);
    setWidgetDraft(null);
    setSaveError('');
    setSelectedTask(null);
    viewingSnapshot.current = null;
    setShareRequest(null);
    if (sidebarOpen) window.requestAnimationFrame(() => mainContent.current?.focus());
    setSidebarOpen(false);
  }

  function openQuestion(match: QuestionMatch, questionId: string) {
    if (!organizationId || match.dashboard.organizationId !== organizationId) return;
    const stillAvailable = dashboards.some(item => item.id === match.dashboard.id && item.widgets.some(widget => widget.id === match.widget.id));
    if (!stillAvailable) return;
    navigate('dashboards', match.dashboard.id);
    setSelectedTask({ organizationId, dashboardId: match.dashboard.id, questionId, widgetId: match.widget.id });
  }

  function openCatalogDashboard(dashboard: Dashboard) {
    const match = questionMatches.find(item => item.dashboard.id === dashboard.id);
    if (match && questionFilter) openQuestion(match, questionFilter);
    else navigate('dashboards', dashboard.id);
  }

  async function createFromExplore(name: string, widget: DashboardWidget) {
    const targetOrganizationId = organizationId;
    if (!canEdit || !targetOrganizationId) return;
    try {
      const created = await dashboardApi.create(targetOrganizationId, { name, description: 'Created from sample-data exploration.', widgets: [widget] });
      if (activeOrganization.current !== targetOrganizationId) return;
      setDashboardList(current => current?.organizationId === targetOrganizationId ? { ...current, items: [created, ...current.items] } : current);
      setToast('Dashboard created from sample data');
      navigate('dashboards', created.id);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Unable to create dashboard.');
      throw exception;
    }
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
      setCreateError(exception instanceof Error ? exception.message : 'Unable to create dashboard.');
    }
  }

  async function saveDashboard() {
    if (!draft || !activeDashboard || saving || !hasChanges || !draft.name.trim()) return;
    const targetOrganizationId = organizationId;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await dashboardApi.update(targetOrganizationId, activeDashboard, draft);
      if (activeOrganization.current !== targetOrganizationId) return;
      setDashboardList(current => current?.organizationId === targetOrganizationId
        ? { ...current, items: current.items.map(item => item.id === updated.id ? updated : item) } : current);
      setDraft(null);
      setEditMode(false);
      setToast('All changes saved');
    } catch (exception) {
      setSaveError(exception instanceof Error ? exception.message : 'Unable to save dashboard. Your edits are still here.');
    } finally {
      setSaving(false);
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

  function share(dashboard: Dashboard, widget?: DashboardWidget, filters?: ConsumerFilters) {
    if (dashboard.organizationId !== organizationId) return;
    const membership = organizations.find(item => item.id === dashboard.organizationId);
    if (!membership) return;
    const snapshotKey = `${dashboard.organizationId}:${dashboard.id}`;
    const selectedFilters = filters ?? (viewingSnapshot.current?.key === snapshotKey
      ? viewingSnapshot.current.filters : defaultConsumerFilters);
    setShareRequest({ dashboard, organizationName: membership.name, filters: { ...selectedFilters }, widget });
  }

  const preview = editMode && draft && activeDashboard
    ? { ...activeDashboard, ...draft } : activeDashboard;
  const featured = dashboards[0];
  const questionMatches = questionFilter ? findQuestionMatches(dashboards, organizationId, questionFilter) : [];
  const filtered = dashboards.filter(item =>
    (!questionFilter || questionMatches.some(match => match.dashboard.id === item.id))
    && `${item.name} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase()));
  const overviewMetrics = sampleOverview(period);
  const overviewIcons = [<BarChart3 size={20} />, <FolderKanban size={20} />, <Users size={20} />, <Activity size={20} />];
  const overviewColors = ['blue', 'violet', 'mint', 'peach'];

  const widgetDraftProblem = widgetDraft ? visualizationProblem(widgetDraft, selectRows(widgetDraft.datasetKey, '12m')) : null;

  function selectVisualizationKind(kind: WidgetKind) {
    if (!widgetDraft) return;
    setWidgetDraft({ ...widgetDraft, kind, ...layoutForChangedKind(widgetDraft, kind), dimensionKey: suggestedDimension(kind, widgetDraft.datasetKey, widgetDraft.metricKey),
      appearance: compatibleAppearance(widgetDraft.appearance, kind, widgetDraft.datasetKey) });
  }

  return (
    <div className="app-shell">
      <button className="skip-link" onClick={() => mainContent.current?.focus()}>Skip to main content</button>
      {sidebarOpen && <button className="mobile-overlay" aria-label="Close navigation" onClick={closeSidebar} />}
      <aside ref={sidebar} className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} onKeyDown={event => {
        if (!sidebarOpen) return;
        if (event.key === 'Escape') { event.stopPropagation(); closeSidebar(); }
        if (event.key !== 'Tab') return;
        const controls = [...(sidebar.current?.querySelectorAll<HTMLElement>('button:not([disabled]),select:not([disabled])') ?? [])];
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
        <button className="brand" onClick={() => navigate('overview')} aria-label="nexa. ANALYTICS STUDIO home">
          <div className="brand-mark"><Activity size={23} strokeWidth={2.4} /></div>
          <div><span className="brand-name">nexa<span>.</span></span><span className="brand-subtitle">ANALYTICS STUDIO</span></div>
        </button>

        <div className="workspace-switch">
          <div className="workspace-avatar">{organization?.name?.charAt(0) ?? 'N'}</div>
          <div className="workspace-details"><strong>{organization?.name ?? 'Your workspace'}</strong><small>{organization?.role ?? 'Organization'}</small></div>
          <ChevronDown size={14} />
          {organizations.length > 1 && <select aria-label="Switch organization" value={organizationId} onChange={event => navigate('overview', undefined, event.target.value)}>
            {organizations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>}
        </div>

        <nav className="sidebar-navigation" aria-label="Workspace navigation">
          <span className="nav-caption">WORKSPACE</span>
          <NavButton active={view.page === 'overview'} label="Overview" onClick={() => navigate('overview')} icon={<Gauge size={18} />} />
          <NavButton active={view.page === 'explore'} label="Explore" onClick={() => navigate('explore')} icon={<Search size={18} />} />
          <NavButton active={view.page === 'dashboards'} label="Dashboards" onClick={() => navigate('dashboards')} icon={<LayoutDashboard size={18} />} count={!dashboardLoadFailed && dashboardList?.organizationId === organizationId ? dashboards.length : undefined} />
          <NavButton active={view.page === 'sources'} label="Data sources" onClick={() => navigate('sources')} icon={<Database size={18} />} />
          <div className="sidebar-divider" />
          <span className="nav-caption">MANAGEMENT</span>
          <NavButton active={view.page === 'settings'} label="Organization" onClick={() => navigate('settings')} icon={<Users size={18} />} />
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-tip"><div className="sidebar-tip-icon"><Sparkles size={17} /></div><strong>Insights, simplified.</strong><p>Build a clearer picture of your data with visual dashboards.</p></div>
          <div className="sidebar-profile"><div className="profile-avatar">{identity?.displayName.slice(0, 2).toUpperCase() ?? 'US'}</div><div><strong>{identity?.displayName ?? 'Signed-in user'}</strong><small>{organization?.name ?? 'Workspace'}</small></div><Ellipsis size={19} /></div>
        </div>
      </aside>

      <div className="main-layout" inert={sidebarOpen}>
        <header className="topbar">
          <div className="topbar-left">
            <button ref={menuButton} className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
            <span className="crumb-root">{organization?.name ?? 'Workspace'}</span><ChevronRight size={15} />
            <span className="crumb-current">{view.id ? activeDashboard?.name ?? 'Dashboard' : view.page === 'overview' ? 'Overview' : view.page === 'explore' ? 'Explore' : view.page === 'sources' ? 'Data sources' : view.page === 'settings' ? 'Organization' : 'Dashboards'}</span>
          </div>
          <div className="topbar-actions">
            <span className="demo-label"><span /> DEMO DATA</span>
            <button className="icon-button topbar-icon" aria-label="Help" title="Documentation is in the repository" onClick={() => navigate('settings')}><CircleHelp size={19} /></button>
            <div className="topbar-user">{identity?.displayName.slice(0, 2).toUpperCase() ?? 'US'}</div>
          </div>
        </header>

        <main ref={mainContent} id="main-content" className="main-content" tabIndex={-1}>
          {organizationNotice && <div role="status" className="info-banner"><ShieldCheck size={20} aria-hidden="true" /><p>{organizationNotice}</p></div>}
          {error && <div role="alert" className="error-banner"><span>{error}</span><button className="error-retry" onClick={() => { focusOnNavigation.current = true; void (organizations.length === 0 ? loadWorkspace() : loadDashboards()); }}>Retry</button></div>}
          {loading ? <div className="loading-state" role="status" aria-live="polite"><div className="loading-spinner" aria-hidden="true" /> Loading workspace…</div>
            : organizations.length === 0 ? <EmptyState title={error ? 'Workspace unavailable' : 'No organizations available'} message={error ? 'We could not load your organization and identity. Retry when the service is available.' : 'Your identity has no assigned organization. Ask your platform administrator for access.'} />
            : dashboardLoadFailed && (view.page === 'overview' || view.page === 'dashboards')
              ? <div><EmptyState title="Dashboards temporarily unavailable" message="We could not check the dashboards in this organization. This is not an empty dashboard list. Retry to load an authorized view." />
                {!error && <button type="button" className="button button-light recovery-action" onClick={() => { focusOnNavigation.current = true; void loadDashboards(); }}>Retry</button>}</div>
            : view.page === 'explore' ? <ExplorePage key={organizationId} canEdit={canEdit} onCreate={createFromExplore} />
            : view.page === 'sources' ? <DataSourcesPage key={organizationId} organizationId={organizationId} organizationName={organization?.name ?? 'Workspace'} canEdit={canEdit} onNotice={setToast} />
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
                    {editMode ? <><button className="button button-quiet" disabled={saving} onClick={stopEditing}>Cancel</button><button className="button button-primary" disabled={!hasChanges || !draft?.name.trim() || saving} onClick={() => void saveDashboard()}><Check size={16} /> {saving ? 'Saving…' : 'Save changes'}</button></>
                      : <><button className="button button-light" onClick={() => share(preview)}><Share2 size={16} /> Share</button>{canEdit && <button className="button button-primary" onClick={() => startEditing()}><SlidersHorizontal size={16} /> Edit dashboard</button>}</>}
                  </div>
                </div>
                {editMode && <div className="composition-status" role="status" aria-live="polite"><div><strong><SlidersHorizontal size={16} /> Composition mode</strong><span>Arrange and configure your dashboard before publishing changes to your team.</span></div><span className={`draft-status ${hasChanges ? 'draft-dirty' : ''}`}>{hasChanges ? 'Unsaved changes' : 'No changes yet'}</span></div>}
                {saveError && editMode && <div role="alert" className="error-banner composition-error">{saveError} Your unsaved work is still available.</div>}
                {!editMode && selectedTask?.organizationId === organizationId && selectedTask.dashboardId === preview.id
                  && <DashboardTaskGuide dashboard={preview} questionId={selectedTask.questionId} widgetId={selectedTask.widgetId} />}
                <DashboardConsumer key={`${organizationId}:${preview.id}`} widgets={preview.widgets} updatedAt={preview.updatedAt} editing={editMode} canEdit={canEdit} onStartEdit={() => startEditing(true)} onEdit={setWidgetDraft} onAdd={() => setWidgetDraft(createWidget())} onChange={widgets => setDraft(current => current ? { ...current, widgets } : current)}
                  onFiltersChange={filters => { viewingSnapshot.current = { key: `${organizationId}:${preview.id}`, filters }; }}
                  onShareInsight={(widget, filters) => share(preview, widget, filters)} />
              </>
            ) : <div><EmptyState title="Dashboard not found" message="This dashboard is unavailable in the selected organization. Return to its dashboard list to choose an accessible view." /><button type="button" className="button button-light recovery-action" onClick={() => navigate('dashboards')}>Back to dashboards</button></div>
            : view.page === 'dashboards' ? (
              <>
                <div className="page-heading"><div><div className="eyebrow">{organization?.name ?? 'YOUR WORKSPACE'} · SAMPLE DATA</div><h1>Dashboards</h1><p>Explore dashboards in this organization. {canEdit ? 'You can create and manage dashboards.' : 'You can view and share dashboards.'}</p></div>{canEdit && <button className="button button-primary" onClick={() => { setDraft(emptyDraft()); setCreateOpen(true); }}><Plus size={18} /> New dashboard</button>}</div>
                <fieldset className="question-filter" aria-label="Find dashboards by business question">
                  <legend>Find a dashboard by question</legend>
                  <div className="question-filter-options">
                    <button type="button" aria-pressed={questionFilter === ''} onClick={() => setQuestionFilter('')}>All dashboards</button>
                    {businessQuestions.map(question => <button type="button" key={question.id} aria-pressed={questionFilter === question.id} onClick={() => setQuestionFilter(question.id)}>{question.question}</button>)}
                  </div>
                </fieldset>
                <div className="list-toolbar"><div className="list-search"><Search size={18} /><input aria-label="Search dashboards" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search dashboards..." /></div><div className="list-count"><LayoutDashboard size={16} /> {filtered.length} dashboards</div></div>
                {(search || questionFilter) && <div className="discovery-summary" role="status"><span>Showing {filtered.length} matching {filtered.length === 1 ? 'dashboard' : 'dashboards'}{questionFilter ? ` for “${businessQuestions.find(item => item.id === questionFilter)?.question}”` : ''}.</span><button type="button" className="text-link" onClick={() => { setSearch(''); setQuestionFilter(''); }}>Clear search and questions</button></div>}
                <div className="dashboard-cards">{filtered.map((item, index) => <article key={item.id} className="dashboard-card"><button className={`dashboard-thumbnail thumbnail-${index % 3}`} onClick={() => openCatalogDashboard(item)} aria-label={`Open ${item.name} — Fictional sample preview`}><div className="thumbnail-bars">{[38, 62, 48, 82, 68, 95, 75, 100, 80, 92, 71, 98].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div><div className="thumbnail-float"><ShieldCheck size={14} /> Fictional sample</div></button><div className="dashboard-card-body"><div className="dashboard-card-title"><h3>{item.name}</h3><button className="icon-button" aria-label={`Share ${item.name}`} title="Review sharing context" onClick={() => share(item, undefined, { ...defaultConsumerFilters })}><Share2 size={16} /></button></div><p>{item.description || 'Your custom analytics workspace.'}</p><div className="card-footer"><span><FileBarChart size={15} /> {item.widgets.length} visuals</span><button onClick={() => openCatalogDashboard(item)}>View dashboard <ArrowRight size={14} /></button></div></div></article>)}
                  {canEdit && <button className="new-dashboard-card" onClick={() => { setDraft(emptyDraft()); setCreateOpen(true); }}><div><Plus size={26} /></div><strong>Create new dashboard</strong><p>Bring your data together in a new view.</p></button>}</div>
                {filtered.length === 0 && <div className="discovery-empty"><EmptyState title={dashboards.length === 0 ? 'No dashboards in this organization' : 'No matching dashboards'} message={dashboards.length === 0 ? canEdit ? 'Create a dashboard with sample visualizations to make a starting point available.' : 'Ask an organization editor to add a dashboard. There are no sample dashboards to explore yet.' : 'Try another business question, clear your search, or browse all dashboards.'} />{(search || questionFilter) && <button type="button" className="button button-light recovery-action" onClick={() => { setSearch(''); setQuestionFilter(''); }}>Show all dashboards</button>}</div>}
                {canEdit && filtered.length > 0 && <section className="manage-section"><h2>Manage dashboards</h2><p>Editors can remove dashboards. All organization members can view and share dashboard links.</p><div>{filtered.map(item => <div className="manage-row" key={item.id}><span>{item.name}</span><button className="icon-button danger-hover" onClick={() => void removeDashboard(item)} title={`Delete ${item.name}`} aria-label={`Delete ${item.name}`}><Trash2 size={16} /></button></div>)}</div></section>}
              </>
            ) : <>
              <div className="page-heading overview-heading"><div><div className="eyebrow">{organization?.name ?? 'YOUR WORKSPACE'} · SAMPLE ANALYTICS <span className="eyebrow-dot" /></div><h1>Welcome back, {identity?.displayName.split(' ')[0] ?? 'there'} <span className="wave">✳</span></h1><p>Explore fictional sample metrics for {organization?.name ?? 'your workspace'}. {canEdit ? 'You can create and manage dashboards.' : 'Your access is view-only.'}</p></div>{canEdit && <button className="button button-primary" onClick={() => { setDraft(emptyDraft()); setCreateOpen(true); }}><Plus size={18} /> New dashboard</button>}</div>
              <DashboardStartingPoints dashboards={dashboards} organizationId={organizationId} onOpen={openQuestion} onBrowse={() => navigate('dashboards')} />
              <div className="summary-row">{overviewMetrics.map((metric, index) => <SummaryCard key={metric.id} icon={overviewIcons[index]} metric={metric} color={overviewColors[index] ?? 'blue'} />)}</div>
              <div className="section-title-row"><div><h2>Performance overview</h2><p>Fictional sample observations, not live customer activity.</p></div><PeriodPicker period={period} setPeriod={setPeriod} /></div>
              <p className="overview-context-note">Month selection uses the final months of an undated Jan–Dec sample, not a rolling or current-year period. It does not change channel observations.</p>
              <div className="overview-charts"><WidgetTile widget={{ id: 'overview-revenue', title: 'Revenue trends', kind: 'area', datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'month' }} period={period} /><WidgetTile widget={{ id: 'overview-sources', title: 'Traffic by channel', kind: 'donut', datasetKey: 'channels', metricKey: 'sessions', dimensionKey: 'channel' }} period={period} /></div>
              <div className="section-title-row recent-header"><div><h2>Recent dashboards</h2><p>Jump back into what you've been working on.</p></div><button className="text-link" onClick={() => navigate('dashboards')}>View all <ArrowRight size={16} /></button></div>
              <div className="recent-list">{dashboards.slice(0, 4).map(item => <button key={item.id} className="recent-item" onClick={() => navigate('dashboards', item.id)}><span className="recent-icon"><LayoutDashboard size={20} /></span><span className="recent-text"><strong>{item.name}</strong><small>{item.widgets.length} visualizations · Dashboard saved {new Date(item.updatedAt).toLocaleDateString()}</small></span><ChevronRight size={18} /></button>)}{!featured && <div className="recent-empty">No dashboards yet. Create your first dashboard to get started.</div>}</div>
              <div className="sample-footnote"><ShieldCheck size={16} /> This workspace uses clearly labeled sample data. Configure real data sources in a future increment.</div>
            </>}
        </main>
      </div>

      {toast && <div className="toast" role="status" aria-live="polite"><Check size={16} aria-hidden="true" />{toast}</div>}
      {shareRequest && organizations.some(item => item.id === shareRequest.dashboard.organizationId) && <ShareContextDialog
        key={`${shareRequest.dashboard.organizationId}:${shareRequest.dashboard.id}:${shareRequest.widget?.id ?? 'dashboard'}`}
        dashboard={shareRequest.dashboard} organizationName={shareRequest.organizationName} filters={shareRequest.filters}
        widget={shareRequest.widget} onDismiss={() => setShareRequest(null)} />}
      {createOpen && draft && <ModalDialog title="Create dashboard" eyebrow="NEW WORKSPACE VIEW" description="Give your dashboard a name. Add visualizations after creating it." initialFocus="input" onDismiss={() => setCreateOpen(false)}>
        {createError && <p role="alert" className="error-banner">{createError}</p>}
        <label className="form-label">Dashboard name<input maxLength={100} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Customer health overview" /></label>
        <label className="form-label">Description<textarea maxLength={500} rows={3} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="What would you like your team to learn from this view?" /></label>
        <div className="modal-actions"><Button variant="light" onClick={() => setCreateOpen(false)}>Cancel</Button><Button disabled={!draft.name.trim()} onClick={() => void createDashboard()}>Create dashboard <ArrowRight size={16} /></Button></div>
      </ModalDialog>}

      {widgetDraft && editMode && draft && <ModalDialog title="Configure visualization" eyebrow="VISUALIZATION BUILDER · SAMPLE DATA" description="Pick a visual, then choose what it should show." className="visualization-modal" initialFocus=".gallery-card" onDismiss={() => setWidgetDraft(null)}>
        <VisualizationGallery kind={widgetDraft.kind} onSelect={selectVisualizationKind} />
        <label className="form-label">Title<input maxLength={100} value={widgetDraft.title} onChange={event => setWidgetDraft({ ...widgetDraft, title: event.target.value })} /></label>
        <section className="visualization-data-fields" aria-label="Data and measures">
          <h2>Data and measures</h2>
          <p>Choose an existing fictional sample dataset and measure. Only supported field combinations are available.</p>
        <label className="form-label">Dataset<select value={widgetDraft.datasetKey} onChange={event => { const datasetKey = event.target.value as DatasetKey; const metricKey = metrics[datasetKey][0]?.key ?? 'orders'; setWidgetDraft({ ...widgetDraft, datasetKey, metricKey, dimensionKey: suggestedDimension(widgetDraft.kind, datasetKey, metricKey), appearance: compatibleAppearance(widgetDraft.appearance, widgetDraft.kind, datasetKey) }); }}>{datasetOptions.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        <label className="form-label">{widgetDraft.kind === 'scatter' ? 'Vertical measure' : 'Metric'}<select value={widgetDraft.metricKey} onChange={event => { const metricKey = event.target.value; setWidgetDraft({ ...widgetDraft, metricKey, dimensionKey: widgetDraft.kind === 'scatter' && widgetDraft.dimensionKey === metricKey ? suggestedDimension('scatter', widgetDraft.datasetKey, metricKey) : widgetDraft.dimensionKey }); }}>{(metrics[widgetDraft.datasetKey] ?? []).map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        {widgetDraft.kind === 'scatter' && <label className="form-label">Horizontal measure<select value={widgetDraft.dimensionKey} onChange={event => setWidgetDraft({ ...widgetDraft, dimensionKey: event.target.value })}>{metrics[widgetDraft.datasetKey].filter(item => item.key !== widgetDraft.metricKey).map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>}
        </section>
        <details className="visualization-appearance">
          <summary>Appearance (optional)</summary>
          <div className="appearance-fields">
            {(widgetDraft.kind === 'donut' || widgetDraft.kind === 'pie') && <>
              <label className="appearance-check"><input type="checkbox" checked={chartAppearance(widgetDraft).showLegend} onChange={event => setWidgetDraft(withAppearance(widgetDraft, { showLegend: event.target.checked }))} /> Show category legend</label>
              <label className="appearance-check"><input type="checkbox" checked={chartAppearance(widgetDraft).showSliceLabels} onChange={event => setWidgetDraft(withAppearance(widgetDraft, { showSliceLabels: event.target.checked }))} /> Show slice labels</label>
              {chartAppearance(widgetDraft).showSliceLabels && <label className="form-label">Maximum slice labels<select value={chartAppearance(widgetDraft).maxSliceLabels} onChange={event => setWidgetDraft(withAppearance(widgetDraft, { maxSliceLabels: Number(event.target.value) as 5 | 8 | 12 }))}><option value={5}>5</option><option value={8}>8</option><option value={12}>12</option></select></label>}
              <p>Labels are limited by value share and available space; the maximum is a ceiling, not a guarantee.</p>
            </>}
            {widgetDraft.kind === 'histogram' && <>
              <label className="form-label">Histogram bins<select value={chartAppearance(widgetDraft).histogramBins} onChange={event => setWidgetDraft(withAppearance(widgetDraft, { histogramBins: Number(event.target.value) }))}>{Array.from({ length: 11 }, (_, index) => index + 2).map(count => <option key={count} value={count}>{count}</option>)}</select></label>
              <p>Counts original sample records in value ranges, not transactions or customers. Identical values produce one bin.</p>
            </>}
            {widgetDraft.datasetKey === 'channels' && ['bar', 'pie', 'donut'].includes(widgetDraft.kind) && <>
              <label className="form-label">Category order<select value={chartAppearance(widgetDraft).categorySort} onChange={event => setWidgetDraft(withAppearance(widgetDraft, { categorySort: event.target.value as 'source' | 'valueAsc' | 'valueDesc' }))}><option value="source">Original source order</option><option value="valueAsc">Smallest measure first</option><option value="valueDesc">Largest measure first</option></select></label>
              <p>Sorting reorders displayed categories only; source values, totals and colors remain unchanged.</p>
            </>}
            {widgetDraft.kind !== 'histogram' && widgetDraft.kind !== 'pie' && widgetDraft.kind !== 'donut' && !(widgetDraft.datasetKey === 'channels' && widgetDraft.kind === 'bar') && <p>This chart uses source-order observations and descriptive axes. No additional appearance settings are needed.</p>}
          </div>
        </details>
        <section className="visualization-preview" aria-label="Live visualization preview">
          <h2>Live preview</h2><p>Original fictional sample records only. This preview does not save changes or query a customer data source.</p>
          <WidgetTile widget={widgetDraft} period="12m" preview />
        </section>
        {widgetDraftProblem && <p role="alert" className="error-banner">{widgetDraftProblem}</p>}
        <div className="modal-actions"><Button variant="light" onClick={() => setWidgetDraft(null)}>Cancel</Button><Button disabled={!widgetDraft.title.trim() || Boolean(widgetDraftProblem)} onClick={() => { setDraft({ ...draft, widgets: draft.widgets.some(item => item.id === widgetDraft.id) ? draft.widgets.map(item => item.id === widgetDraft.id ? widgetDraft : item) : [...draft.widgets, widgetDraft] }); setWidgetDraft(null); }}><Check size={16} /> {draft.widgets.some(item => item.id === widgetDraft.id) ? 'Update visualization' : 'Add to dashboard'}</Button></div>
      </ModalDialog>}
    </div>
  );
}

function NavButton({ active, label, icon, onClick, count }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void; count?: number }) {
  return <button className={`nav-button ${active ? 'nav-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={onClick}>{icon}<span>{label}</span>{count !== undefined && <small>{count}</small>}</button>;
}

function PeriodPicker({ period, setPeriod }: { period: string; setPeriod: (period: string) => void }) {
  return <div className="period-picker"><CalendarDays size={16} /><select aria-label="Period" value={period} onChange={event => setPeriod(event.target.value)}><option value="3m">Final 3 sample months</option><option value="6m">Final 6 sample months</option><option value="12m">All 12 sample months</option></select><ChevronDown size={14} /></div>;
}

function SummaryCard({ icon, metric, color }: { icon?: React.ReactNode; metric: OverviewMetric; color: string }) {
  const format = metric.id === 'commerce-revenue' ? 'revenue' : metric.id.split('-')[1]!;
  return <article className="summary-card" aria-label={metric.label}>
    <div className="summary-top"><div className={`summary-icon icon-${color}`}>{icon}</div></div>
    <div className="summary-title">{metric.label}</div>
    <div className="summary-value">{formatMetric(metric.value, format)}</div>
    <div className="summary-bottom">{metric.context.coverage}</div>
    <details className="summary-definition"><summary>About this figure</summary><p>{metric.context.meaning}</p><p>Exact value: {formatDetailedMetric(metric.value, format)} {metric.context.unit}.</p><p>{metric.context.provenance}</p><p>{metric.context.limitation}</p></details>
  </article>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="empty-state"><div><LayoutDashboard size={30} /></div><h2>{title}</h2><p>{message}</p></div>;
}

function SettingsPage({ organization }: { organization?: Membership }) {
  const mayManage = organization?.role === 'owner' || organization?.role === 'editor';
  return <><div className="page-heading"><div><div className="eyebrow">ORGANIZATION CONTEXT · SAMPLE ENVIRONMENT</div><h1>Organization</h1><p>See which organization you're using and what you can do here.</p></div></div><div className="settings-card"><div className="settings-card-icon"><Users size={22} /></div><div><h2>{organization?.name ?? 'Organization'}</h2><p>Organization reference: <code>{organization?.id}</code></p><span className="role-pill"><ShieldCheck size={14} /> Your role: {organization?.role ?? 'member'}</span></div></div><div className="settings-grid"><article className="settings-section"><div className="settings-title"><LockKeyhole size={21} /><h3>Your access</h3></div><p>{mayManage ? 'You can view dashboards, create and edit dashboard content, and manage data-source registration metadata in this organization.' : 'You can view and share dashboards in this organization. Creating or changing dashboards and data-source definitions requires editor or owner access.'}</p><div className="settings-detail"><span>Current role</span><strong>{organization?.role ?? 'member'}</strong></div><div className="settings-detail"><span>Permissions</span><strong>{mayManage ? 'View and manage dashboards' : 'View dashboards'}</strong></div><p>Permissions and organization membership are checked by the server on every protected request. The organization shown in a URL does not grant access.</p></article><article className="settings-section"><div className="settings-title"><Database size={21} /><h3>Data-source status</h3></div><p>Data-source records contain provider and display-name metadata only. They do not provide live data to these sample visualizations.</p><div className="settings-detail"><span>Registered sources</span><strong>Metadata only</strong></div><div className="settings-detail"><span>Live connections</span><strong>Unavailable</strong></div><div className="settings-detail"><span>Dashboard data</span><strong>Fictional demonstration data</strong></div></article></div><div className="sample-footnote"><BookOpen size={16} /> Production identity integration, live connections and provisioning are not enabled. See the repository documentation for security boundaries.</div></>;
}
