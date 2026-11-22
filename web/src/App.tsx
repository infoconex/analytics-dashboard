import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, BarChart3, BookOpen,
  CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp,
  Cloud, Database, Ellipsis, ExternalLink, FileBarChart, Filter, FolderKanban,
  Gauge, LayoutDashboard, LockKeyhole, Menu, Plus, Search,
  Settings2, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, Undo2, Redo2,
  Users,
} from 'lucide-react';
import { dashboardApi, visualizationApi } from './api';
import { copySavedVisualization, duplicateWidget, hasDashboardChanges } from './composition';
import { captureWidgetChange, emptyWidgetHistory, redoWidgetChange, undoWidgetChange } from './dashboardUndo';
import { widgetEditorHasChanges } from './authoringWorkflow';
import { createWidget, datasetOptions, dimensions, formatDetailedMetric, formatMetric, metrics } from './demoData';
import { sampleOverview, type OverviewMetric } from './sampleInterpretation';
import { ApiError, type CurrentIdentity, type Dashboard, type DashboardDraft, type DashboardWidget, type DatasetKey, type Membership, type SavedVisualization, type WidgetKind } from './model';
import { DashboardConsumer } from './DashboardConsumer';
import { WidgetTile } from './WidgetTile';
import { DataSourcesPage } from './DataSourcesPage';
import { ExplorePage } from './ExplorePage';
import { VisualizationGallery } from './VisualizationGallery';
import { VisualizationLibraryPicker, initialLibraryDiscoveryContext, type LibraryDiscoveryContext } from './VisualizationLibraryPicker';
import { Button } from './ui/Button';
import { ModalDialog } from './ui/ModalDialog';
import { isSupportedAppHash, organizationHash, parseOrganizationHash } from './organizationRoute';
import { businessQuestions, findQuestionMatches, type QuestionMatch } from './dashboardDiscovery';
import { discoverDashboards, savedDateLabel, type DiscoveryOrder } from './contentDiscovery';
import { canRestoreCatalogReturn, readNavigationIndex, withNavigationIndex, type CatalogReturnPoint } from './navigationContinuity';
import { DashboardStartingPoints } from './DashboardStartingPoints';
import { DashboardTaskGuide } from './DashboardTaskGuide';
import { ShareContextDialog } from './ShareContextDialog';
import { defaultConsumerFilters } from './consumerFilters';
import type { ConsumerFilters } from './consumerFilters';
import { suggestedDimension } from './visualizationSemantics';
import { sampleConfigurationIssue } from './sampleAvailability';
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
  const [dashboardOrder, setDashboardOrder] = useState<DiscoveryOrder>('recent');
  const [questionFilter, setQuestionFilter] = useState('');
  const [selectedTask, setSelectedTask] = useState<{ organizationId: string; dashboardId: string; questionId: string; widgetId: string } | null>(null);
  const [period, setPeriod] = useState('12m');
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<DashboardDraft | null>(null);
  const [undoHistory, setUndoHistory] = useState(emptyWidgetHistory);
  const [undoFeedback, setUndoFeedback] = useState('');
  const [returnToLibrary, setReturnToLibrary] = useState(false);
  const [widgetDraft, setWidgetDraft] = useState<DashboardWidget | null>(null);
  const widgetBaseline = useRef<{ widget: DashboardWidget; description: string } | null>(null);
  const widgetEditorInitialFocus = useRef('.gallery-card');
  const [library, setLibrary] = useState<{ organizationId: string; items: SavedVisualization[] } | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryDiscovery, setLibraryDiscovery] = useState<LibraryDiscoveryContext>(initialLibraryDiscoveryContext);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [libraryEditing, setLibraryEditing] = useState<SavedVisualization | null>(null);
  const [libraryDescription, setLibraryDescription] = useState('');
  const [librarySource, setLibrarySource] = useState<DashboardWidget | null>(null);
  const [libraryName, setLibraryName] = useState('');
  const [librarySourceDescription, setLibrarySourceDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  // Only in memory: stale saves never replace either the user's draft or a newer server revision.
  const [dashboardConflict, setDashboardConflict] = useState<Dashboard | 'unavailable' | null>(null);
  const [templateConflict, setTemplateConflict] = useState<SavedVisualization | 'deleted' | 'unavailable' | null>(null);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [organizationNotice, setOrganizationNotice] = useState('');
  const [shareRequest, setShareRequest] = useState<{ dashboard: Dashboard; organizationName: string; filters: ConsumerFilters; widget?: DashboardWidget } | null>(null);
  const viewingSnapshot = useRef<{ key: string; filters: ConsumerFilters } | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const mainContent = useRef<HTMLElement>(null);
  const saveChangesButton = useRef<HTMLButtonElement>(null);
  const skipNextHashPrompt = useRef(false);
  const acceptedHash = useRef(window.location.hash);
  const focusOnNavigation = useRef(false);
  const catalogReturn = useRef<CatalogReturnPoint | null>(null);
  const restoreCatalog = useRef(false);
  const navigationIndex = useRef(readNavigationIndex(window.history.state) ?? 0);
  const acceptedNavigationIndex = useRef(navigationIndex.current);
  const reversingHistory = useRef(false);
  const focusAfterEditTransition = useRef<'edit' | 'view' | null>(null);

  // Mark visited hash entries without changing the URL or overwriting unrelated history state.
  // A declined Back/Forward confirmation can then reverse the traversal rather than
  // rewriting an existing history entry (which breaks subsequent Forward navigation).
  useEffect(() => {
    if (readNavigationIndex(window.history.state) === null) {
      window.history.replaceState(withNavigationIndex(window.history.state, acceptedNavigationIndex.current), '', window.location.href);
    }
  }, []);

  const organization = organizations.find(item => item.id === organizationId);
  const canEdit = organization?.role === 'owner' || organization?.role === 'editor';
  const dashboards = dashboardList?.organizationId === organizationId
    ? dashboardList.items.filter(item => item.organizationId === organizationId) : [];
  const activeDashboard = dashboards.find(item => item.id === view.id);
  const hasChanges = Boolean(editMode && draft && activeDashboard && hasDashboardChanges(draft, activeDashboard));
  // Configuration edits and a named new dashboard can be lost on refresh even before
  // they are committed to a dashboard draft. Never persist them into browser storage.
  const hasPendingWork = Boolean(hasChanges || widgetDraft || librarySource
    || (createOpen && draft && (draft.name.trim() || draft.description.trim())));

  // In a long visualization editor, the recovery banner may sit above the
  // current scroll position. Bring the actionable conflict into view and focus
  // after the server response; the unsaved editor fields remain untouched.
  useEffect(() => {
    if (!templateConflict) return;
    const frame = window.requestAnimationFrame(() => {
      const region = document.querySelector<HTMLElement>('[aria-label="Template conflict recovery"]');
      region?.scrollIntoView({ block: 'center' });
      region?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [templateConflict]);

  // Only outside text fields and dialogs: never steal native input undo.
  useEffect(() => {
    if (!editMode || !canEdit || !draft || saving || widgetDraft || libraryOpen || librarySource || createOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.repeat || event.isComposing) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"], dialog')) return;
      const key = event.key.toLowerCase();
      const redo = (key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey);
      const undo = key === 'z' && !event.shiftKey;
      if (redo && undoHistory.future.length) {
        event.preventDefault();
        redoDashboardWidgets();
      } else if (undo && undoHistory.past.length) {
        event.preventDefault();
        undoDashboardWidgets();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editMode, canEdit, draft, saving, widgetDraft, libraryOpen, librarySource, createOpen, undoHistory]);

  useEffect(() => { if (createOpen) setCreateError(''); }, [createOpen]);

  // Discovery is ephemeral consumer context, never persisted across tenants.
  useEffect(() => {
    setSearch(''); setQuestionFilter(''); setDashboardOrder('recent'); setSelectedTask(null);
    setLibrary(null); setLibraryOpen(false); setLibraryEditing(null); setLibrarySource(null);
    setLibraryDiscovery(initialLibraryDiscoveryContext);
    setLibraryError(''); setLibraryLoading(false);
    widgetBaseline.current = null;
    resetWidgetUndo(); setReturnToLibrary(false);
    catalogReturn.current = null;
    restoreCatalog.current = false;
  }, [organizationId]);

  useEffect(() => {
    if (sidebarOpen) sidebar.current?.querySelector<HTMLButtonElement>('.nav-button')?.focus();
  }, [sidebarOpen]);

  function closeSidebar() {
    setSidebarOpen(false);
    window.requestAnimationFrame(() => menuButton.current?.focus());
  }

  function confirmDiscard(): boolean {
    return !hasPendingWork || window.confirm('Discard your unsaved authoring changes?');
  }

  function resetWidgetUndo() {
    setUndoHistory(emptyWidgetHistory());
    setUndoFeedback('');
  }

  // Widget-array history only; dashboard metadata fields retain native input undo.
  function commitWidgets(next: DashboardWidget[]) {
    if (!draft || !editMode || !canEdit || saving) return;
    const history = captureWidgetChange(undoHistory, draft.widgets, next);
    if (!history) return;
    setUndoHistory(history);
    setDraft({ ...draft, widgets: next });
    setUndoFeedback('Widget change recorded. Undo is available until dashboard Save or Cancel.');
  }

  function undoDashboardWidgets() {
    if (!draft || !editMode || !canEdit || saving || widgetDraft || libraryOpen || librarySource) return;
    const previous = undoWidgetChange(undoHistory, draft.widgets);
    if (!previous) return;
    setDraft({ ...draft, widgets: previous.widgets });
    setUndoHistory(previous.history);
    setUndoFeedback('Widget change undone. The dashboard draft is not yet saved.');
  }

  function redoDashboardWidgets() {
    if (!draft || !editMode || !canEdit || saving || widgetDraft || libraryOpen || librarySource) return;
    const next = redoWidgetChange(undoHistory, draft.widgets);
    if (!next) return;
    setDraft({ ...draft, widgets: next.widgets });
    setUndoHistory(next.history);
    setUndoFeedback('Widget change redone. The dashboard draft is not yet saved.');
  }

  function beginWidgetEditor(widget: DashboardWidget, template: SavedVisualization | null = null, backToLibrary = false) {
    widgetBaseline.current = { widget: structuredClone(widget), description: template?.description ?? '' };
    widgetEditorInitialFocus.current = sampleConfigurationIssue(widget) ? '[data-repair-summary]' : '.gallery-card';
    setWidgetDraft({ ...widget, appearance: widget.appearance ? { ...widget.appearance } : undefined });
    setLibraryEditing(template);
    setTemplateConflict(null);
    setReturnToLibrary(backToLibrary);
    setLibraryError('');
  }

  function dismissVisualizationEditor() {
    if (widgetDraft && widgetBaseline.current
      && (templateConflict || widgetEditorHasChanges(widgetDraft, widgetBaseline.current.widget,
        libraryEditing ? libraryDescription : '', widgetBaseline.current.description))
      && !window.confirm(`Discard your unsaved ${libraryEditing ? 'library template' : 'visualization'} changes?`)) return;
    const backToLibrary = returnToLibrary;
    widgetBaseline.current = null;
    setWidgetDraft(null);
    setLibraryEditing(null);
    setTemplateConflict(null);
    setLibraryError('');
    setReturnToLibrary(false);
    if (backToLibrary) setLibraryOpen(true);
    else if (widgetDraft && draft?.widgets.some(item => item.id === widgetDraft.id)) focusDraftWidget(widgetDraft.id);
  }

  function dismissCreateDashboard() {
    if (draft && (draft.name.trim() || draft.description.trim())
      && !window.confirm('Discard the unsaved dashboard name and description?')) return;
    setCreateOpen(false);
    setCreateError('');
    setDraft(null);
  }

  function stopEditing() {
    if (!confirmDiscard()) return;
    widgetBaseline.current = null;
    focusAfterEditTransition.current = 'view';
    setEditMode(false);
    setDraft(null);
    resetWidgetUndo();
    setReturnToLibrary(false);
    setWidgetDraft(null);
    setLibraryOpen(false);
    setLibrarySource(null);
    setLibraryEditing(null);
    setSaveError('');
    setDashboardConflict(null);
    setTemplateConflict(null);
  }

  function startEditing(openGallery = false) {
    if (!canEdit || !activeDashboard) return;
    resetWidgetUndo();
    setReturnToLibrary(false);
    setDraft({ name: activeDashboard.name, description: activeDashboard.description,
      widgets: activeDashboard.widgets.map(item => ({ ...item })) });
    setSaveError('');
    setDashboardConflict(null);
    focusAfterEditTransition.current = openGallery ? null : 'edit';
    setEditMode(true);
    if (openGallery) beginWidgetEditor(createWidget());
  }

  function beginVisualizationRepair(widget: DashboardWidget) {
    if (!canEdit || !activeDashboard || editMode || !activeDashboard.widgets.some(item => item.id === widget.id)) return;
    startEditing();
    // A modal is about to own focus; do not focus an inert dashboard title.
    focusAfterEditTransition.current = null;
    beginWidgetEditor(widget);
  }

  useEffect(() => {
    const handleHash = () => {
      if (reversingHistory.current) {
        reversingHistory.current = false;
        return;
      }
      const internalNavigation = skipNextHashPrompt.current;
      // navigate() has already changed view and cleared or initialized editing.
      // Reprocessing its hashchange would reset a freshly created dashboard editor.
      if (internalNavigation) {
        skipNextHashPrompt.current = false;
        acceptedHash.current = window.location.hash;
        return;
      }
      if (!confirmDiscard()) {
        const attemptedIndex = readNavigationIndex(window.history.state);
        if (attemptedIndex !== null && attemptedIndex !== acceptedNavigationIndex.current) {
          // Undo the actual traversal, including multi-entry Back/Forward jumps.
          reversingHistory.current = true;
          window.history.go(acceptedNavigationIndex.current - attemptedIndex);
        } else {
          // Manually entered hashes are not known history traversals.
          window.history.replaceState(withNavigationIndex(window.history.state, acceptedNavigationIndex.current), '', acceptedHash.current || '#/');
        }
        return;
      }
      skipNextHashPrompt.current = false;
      const previousHash = acceptedHash.current;
      acceptedHash.current = window.location.hash;
      const visitedIndex = readNavigationIndex(window.history.state);
      if (visitedIndex !== null) {
        acceptedNavigationIndex.current = visitedIndex;
        navigationIndex.current = Math.max(navigationIndex.current, visitedIndex);
      } else {
        acceptedNavigationIndex.current = ++navigationIndex.current;
        window.history.replaceState(withNavigationIndex(window.history.state, acceptedNavigationIndex.current), '', window.location.href);
      }
      const origin = catalogReturn.current;
      restoreCatalog.current = Boolean(origin
        && previousHash === organizationHash(origin.organizationId, 'dashboards', origin.dashboardId)
        && window.location.hash === organizationHash(origin.organizationId, 'dashboards'));
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
      widgetBaseline.current = null;
      setEditMode(false);
      setDraft(null);
      resetWidgetUndo();
      setReturnToLibrary(false);
      setWidgetDraft(null);
      setLibraryOpen(false);
      setLibrarySource(null);
      setLibraryEditing(null);
      setLibraryError('');
      setCreateOpen(false);
      setSaveError('');
      setDashboardConflict(null);
      setTemplateConflict(null);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [organizations, hasPendingWork]);

  // Changing between viewing and editing replaces the invoking toolbar button.
  // Keep keyboard users at the equivalent action rather than dropping focus to body.
  useEffect(() => {
    const targetMode = focusAfterEditTransition.current;
    if (!targetMode || loading || !view.id) return;
    if (targetMode === 'edit' && !editMode) return;
    if (targetMode === 'view' && editMode) return;
    focusAfterEditTransition.current = null;
    const frame = window.requestAnimationFrame(() => {
      const target = targetMode === 'edit'
        ? mainContent.current?.querySelector<HTMLInputElement>('.dashboard-heading .title-edit')
        : mainContent.current?.querySelector<HTMLButtonElement>('.dashboard-heading .heading-actions .button-primary');
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editMode, loading, view]);

  // Navigation replaces the previous control; place keyboard focus on the new
  // page heading instead of leaving it on a detached element. The question
  // guide owns focus when a customer explicitly chose a business question.
  useEffect(() => {
    if (!focusOnNavigation.current || loading) return;
    // Catalog return restores focus to the opened card instead of an unrelated page heading.
    if (restoreCatalog.current && view.page === 'dashboards' && !view.id) return;
    if (selectedTask?.organizationId === organizationId && selectedTask.dashboardId === view.id) {
      focusOnNavigation.current = false;
      return;
    }
    const heading = mainContent.current?.querySelector<HTMLElement>('.page-heading h1, .canvas-empty-start h2, .empty-state h2, .embedded-state h1');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    focusOnNavigation.current = false;
  }, [view, loading, selectedTask, organizationId, dashboardLoadFailed]);

  useEffect(() => {
    if (loading || !restoreCatalog.current || view.page !== 'dashboards' || view.id) return;
    restoreCatalog.current = false;
    const origin = catalogReturn.current;
    const eligible = canRestoreCatalogReturn(origin, organizationId, dashboards);
    const frame = window.requestAnimationFrame(() => {
      const cards = mainContent.current?.querySelectorAll<HTMLElement>('.dashboard-card[data-dashboard-id]');
      const card = eligible && origin
        ? [...(cards ?? [])].find(item => item.dataset.dashboardId === origin.dashboardId)
        : null;
      const button = card?.querySelector<HTMLButtonElement>('.catalog-card-actions button');
      if (button && origin) {
        button.focus({ preventScroll: true });
        window.scrollTo({ top: origin.scrollY, behavior: 'instant' });
      } else {
        const heading = mainContent.current?.querySelector<HTMLElement>('.page-heading h1');
        heading?.focus({ preventScroll: true });
      }
      focusOnNavigation.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [view, organizationId, loading, dashboardList, search, questionFilter, dashboardOrder]);

  useEffect(() => {
    if (!hasPendingWork) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasPendingWork]);

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

  function navigate(next: Page, id?: string, nextOrganizationId = organizationId, justCreated = false) {
    if (!justCreated && !confirmDiscard()) return;
    if (!organizations.some(item => item.id === nextOrganizationId)) return;
    const nextHash = organizationHash(nextOrganizationId, next, id);
    const origin = catalogReturn.current;
    restoreCatalog.current = Boolean(origin && view.id === origin.dashboardId
      && organizationId === origin.organizationId && nextOrganizationId === origin.organizationId
      && next === 'dashboards' && !id);
    focusOnNavigation.current = true;
    focusAfterEditTransition.current = null;
    skipNextHashPrompt.current = window.location.hash !== nextHash;
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
      acceptedNavigationIndex.current = ++navigationIndex.current;
      window.history.replaceState(withNavigationIndex(window.history.state, acceptedNavigationIndex.current), '', nextHash);
    }
    acceptedHash.current = window.location.hash;
    if (nextOrganizationId !== organizationId) setOrganizationId(nextOrganizationId);
    setOrganizationNotice('');
    setView({ page: next, id });
    widgetBaseline.current = null;
    setEditMode(false);
    setDraft(null);
    resetWidgetUndo();
    setReturnToLibrary(false);
    setWidgetDraft(null);
    setLibraryOpen(false);
    setLibrarySource(null);
    setLibraryEditing(null);
    setLibraryError('');
    setCreateOpen(false);
    setSaveError('');
    setDashboardConflict(null);
    setTemplateConflict(null);
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
    if (dashboard.organizationId !== organizationId || !dashboards.some(item => item.id === dashboard.id)) return;
    catalogReturn.current = { organizationId, dashboardId: dashboard.id, scrollY: window.scrollY };
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
    if (!draft || !organizationId || !canEdit || !createOpen || creating || !draft.name.trim()) return;
    const targetOrganizationId = organizationId;
    setCreating(true);
    setCreateError('');
    try {
      const created = await dashboardApi.create(targetOrganizationId, draft);
      if (activeOrganization.current !== targetOrganizationId) return;
      setDashboardList(current => current?.organizationId === targetOrganizationId
        ? { ...current, items: [created, ...current.items] } : current);
      setCreateOpen(false);
      // The dashboard itself was persisted by POST. Only later composition changes
      // need Save changes; do not manufacture an unsaved initial revision.
      navigate('dashboards', created.id, targetOrganizationId, true);
      resetWidgetUndo();
      setDraft({ name: created.name, description: created.description,
        widgets: created.widgets.map(widget => ({ ...widget })) });
      setEditMode(true);
      // An inline first-action panel communicates the persisted state without
      // a toast covering its mobile buttons.
      setToast('');
      window.requestAnimationFrame(() => window.scrollTo(0, 0));
    } catch (exception) {
      if (activeOrganization.current === targetOrganizationId) {
        setCreateError(exception instanceof Error ? exception.message : 'Unable to create dashboard.');
      }
    } finally {
      setCreating(false);
    }
  }

  async function saveDashboard() {
    if (!draft || !activeDashboard || saving || dashboardConflict || !hasChanges || !draft.name.trim()) return;
    const targetOrganizationId = organizationId;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await dashboardApi.update(targetOrganizationId, activeDashboard, draft);
      if (activeOrganization.current !== targetOrganizationId) return;
      setDashboardList(current => current?.organizationId === targetOrganizationId
        ? { ...current, items: current.items.map(item => item.id === updated.id ? updated : item) } : current);
      setDraft(null);
      focusAfterEditTransition.current = 'view';
      setEditMode(false);
      resetWidgetUndo();
      setDashboardConflict(null);
      setToast('All changes saved');
    } catch (exception) {
      if (activeOrganization.current !== targetOrganizationId) return;
      if (exception instanceof ApiError && exception.status === 409) {
        setSaveError('Another editor saved a newer dashboard revision. Your local draft was not overwritten.');
        try {
          const current = await dashboardApi.find(targetOrganizationId, activeDashboard.id);
          if (activeOrganization.current === targetOrganizationId) setDashboardConflict(current);
        } catch {
          if (activeOrganization.current === targetOrganizationId) setDashboardConflict('unavailable');
        }
      } else {
        setSaveError(exception instanceof Error ? exception.message : 'Unable to save dashboard.');
      }
    } finally {
      setSaving(false);
    }
  }

  // Deliberate, server-authorized recovery: never auto-merge, auto-revise or overwrite a conflict.
  async function reloadCurrentDashboard() {
    if (!activeDashboard || !dashboardConflict || saving) return;
    if (!window.confirm('Discard your unsaved dashboard edits and load the latest saved version?')) return;
    const org = organizationId;
    setSaving(true);
    try {
      const latest = await dashboardApi.find(org, activeDashboard.id);
      if (activeOrganization.current !== org) return;
      setDashboardList(current => current?.organizationId === org
        ? { ...current, items: current.items.map(item => item.id === latest.id ? latest : item) } : current);
      setDraft(null);
      focusAfterEditTransition.current = 'view';
      setEditMode(false);
      resetWidgetUndo();
      setDashboardConflict(null);
      setSaveError('');
      setToast('Latest saved dashboard loaded. Your previous draft was discarded.');
    } catch {
      if (activeOrganization.current === org) setSaveError('Unable to load the latest authorized dashboard. Your draft is still available.');
    } finally { setSaving(false); }
  }

  async function inspectCurrentDashboard() {
    if (!activeDashboard || saving) return;
    const org = organizationId;
    try {
      const latest = await dashboardApi.find(org, activeDashboard.id);
      if (activeOrganization.current === org) setDashboardConflict(latest);
    } catch {
      if (activeOrganization.current === org) setDashboardConflict('unavailable');
    }
  }

  async function removeDashboard(dashboard: Dashboard) {
    if (!canEdit || dashboard.organizationId !== organizationId) return;
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

  async function openSavedLibrary(preserveDiscovery = false) {
    const org = organizationId;
    if (!canEdit || !org || !editMode) return;
    if (!preserveDiscovery) setLibraryDiscovery(initialLibraryDiscoveryContext);
    setLibraryError('');
    setLibraryOpen(true);
    setLibraryLoading(true);
    try {
      const items = await visualizationApi.list(org);
      if (activeOrganization.current === org) setLibrary({ organizationId: org, items });
    } catch (exception) {
      if (activeOrganization.current === org) {
        setLibrary(null);
        setLibraryError(exception instanceof Error ? exception.message : 'Unable to load saved visualizations.');
      }
    } finally {
      if (activeOrganization.current === org) setLibraryLoading(false);
    }
  }

  // A library/builder modal may close far from the visualization that changed.
  // Return keyboard and scroll context to the affected chart, but never to
  // another dashboard or organization. This does not persist any user state.
  function focusDraftWidget(widgetId: string) {
    const originOrganization = organizationId;
    const originDashboard = view.id;
    window.requestAnimationFrame(() => {
      if (!originDashboard || activeOrganization.current !== originOrganization
        || window.location.hash !== organizationHash(originOrganization, 'dashboards', originDashboard)) return;
      const heading = document.getElementById(`widget-heading-${widgetId}`);
      if (!heading) return;
      heading.scrollIntoView({ block: 'center', behavior: 'instant' });
      heading.focus({ preventScroll: true });
    });
  }

  function useSavedVisualization(saved: SavedVisualization) {
    if (!editMode || !draft || saved.organizationId !== organizationId || draft.widgets.length >= 24) return;
    const copy = copySavedVisualization(saved.definition, crypto.randomUUID());
    const firstVisualization = draft.widgets.length === 0;
    commitWidgets([...draft.widgets, copy]);
    setLibraryOpen(false);
    setToast('Added an independent copy. Save the dashboard to keep it.');
    if (firstVisualization) window.requestAnimationFrame(() => saveChangesButton.current?.focus());
    else focusDraftWidget(copy.id);
  }

  function editSavedVisualization(saved: SavedVisualization) {
    if (!canEdit || saved.organizationId !== organizationId) return;
    setLibraryDescription(saved.description);
    beginWidgetEditor(saved.definition, saved, true);
    setLibraryOpen(false);
  }

  async function deleteSavedVisualization(saved: SavedVisualization) {
    if (!canEdit || saved.organizationId !== organizationId || libraryBusy) return;
    if (!window.confirm(`Delete saved template "${saved.definition.title}"? Existing dashboard copies will remain unchanged.`)) return;
    const org = organizationId;
    setLibraryBusy(true);
    setLibraryError('');
    try {
      await visualizationApi.remove(org, saved);
      if (activeOrganization.current === org) setLibrary(current => current?.organizationId === org
        ? { ...current, items: current.items.filter(item => item.id !== saved.id) } : current);
    } catch (exception) {
      if (activeOrganization.current !== org) return;
      if (exception instanceof ApiError && (exception.status === 409 || exception.status === 404)) {
        try {
          const latest = await visualizationApi.list(org);
          if (activeOrganization.current !== org) return;
          setLibrary({ organizationId: org, items: latest });
          setLibraryError(latest.some(item => item.id === saved.id)
            ? 'This template changed in another session. The library was refreshed; review it before choosing Delete template again.'
            : 'This template has already been removed in another session. Existing dashboard copies remain unchanged.');
        } catch {
          if (activeOrganization.current === org) setLibraryError('This template changed, but the library could not be refreshed. Retry loading the library.');
        }
      } else {
        setLibraryError(exception instanceof Error ? exception.message : 'Could not delete template.');
      }
    } finally { setLibraryBusy(false); }
  }

  function offerSaveToLibrary(widget: DashboardWidget) {
    setLibrarySource(widget);
    setLibraryName(widget.title);
    setLibrarySourceDescription('');
    setLibraryError('');
  }

  async function saveToLibrary() {
    const source = librarySource;
    const org = organizationId;
    if (!source || !canEdit || !libraryName.trim() || libraryBusy) return;
    setLibraryBusy(true);
    setLibraryError('');
    try {
      const saved = await visualizationApi.create(org, {
        description: librarySourceDescription,
        definition: { ...source, title: libraryName.trim() },
      });
      if (activeOrganization.current !== org) return;
      setLibrary(current => current?.organizationId === org
        ? { ...current, items: [saved, ...current.items] } : { organizationId: org, items: [saved] });
      setLibrarySource(null);
      setToast('Reusable visualization saved independently of the dashboard.');
    } catch (exception) {
      if (activeOrganization.current === org) setLibraryError(exception instanceof Error ? exception.message : 'Unable to save template.');
    } finally { setLibraryBusy(false); }
  }

  async function finishWidgetEdit() {
    if (!widgetDraft || !draft || libraryBusy || sampleConfigurationIssue(widgetDraft)) return;
    if (libraryEditing) {
      const org = organizationId;
      if (templateConflict) return; // The user must explicitly reload a newer revision.
      setLibraryBusy(true);
      setLibraryError('');
      try {
        const saved = await visualizationApi.update(org, libraryEditing, {
          description: libraryDescription,
          definition: widgetDraft,
        });
        if (activeOrganization.current !== org) return;
        setLibrary(current => current?.organizationId === org
          ? { ...current, items: current.items.map(item => item.id === saved.id ? saved : item) } : current);
        widgetBaseline.current = null;
        setWidgetDraft(null);
        setLibraryEditing(null);
        setTemplateConflict(null);
        setReturnToLibrary(false);
        setLibraryOpen(true);
        setToast('Template updated independently. Your dashboard draft was not saved or changed.');
      } catch (exception) {
        if (activeOrganization.current !== org) return;
        if (exception instanceof ApiError && (exception.status === 409 || exception.status === 404)) {
          setLibraryError('The template was changed or deleted in another session. Your template edits remain here, unsaved.');
          try {
            const latest = await visualizationApi.list(org);
            if (activeOrganization.current !== org) return;
            setLibrary({ organizationId: org, items: latest });
            setTemplateConflict(latest.find(item => item.id === libraryEditing.id) ?? 'deleted');
          } catch {
            if (activeOrganization.current === org) setTemplateConflict('unavailable');
          }
        } else {
          setLibraryError(exception instanceof Error ? exception.message : 'Could not update template.');
        }
      } finally { setLibraryBusy(false); }
    } else {
      const alreadyOnDashboard = draft.widgets.some(item => item.id === widgetDraft.id);
      const firstVisualization = !alreadyOnDashboard && draft.widgets.length === 0;
      const changed = !alreadyOnDashboard || (widgetBaseline.current !== null
        && widgetEditorHasChanges(widgetDraft, widgetBaseline.current.widget));
      commitWidgets(alreadyOnDashboard
        ? draft.widgets.map(item => item.id === widgetDraft.id ? widgetDraft : item)
        : [...draft.widgets, widgetDraft]);
      widgetBaseline.current = null;
      setWidgetDraft(null);
      setReturnToLibrary(false);
      if (changed) setToast(alreadyOnDashboard
        ? 'Visualization updated in dashboard draft. Save changes to keep it.'
        : 'Visualization added to dashboard draft. Save changes to keep it.');
      // The first empty-state action unmounts when its widget is added.
      // Place focus on the next required action instead of losing it to <body>.
      if (firstVisualization) window.requestAnimationFrame(() => saveChangesButton.current?.focus());
      else focusDraftWidget(widgetDraft.id);
    }
  }

  function reopenCurrentTemplate() {
    if (!libraryEditing || !templateConflict || libraryBusy) return;
    if (!window.confirm('Discard your unsaved template edits and reopen the latest saved template?')) return;
    if (typeof templateConflict !== 'string') {
      setLibraryDescription(templateConflict.description);
      beginWidgetEditor(templateConflict.definition, templateConflict, true);
      setLibraryError('');
      setTemplateConflict(null);
    } else {
      widgetBaseline.current = null;
      setLibraryEditing(null);
      setWidgetDraft(null);
      setTemplateConflict(null);
      setLibraryOpen(true);
      void openSavedLibrary(true);
    }
  }

  const preview = editMode && draft && activeDashboard
    ? { ...activeDashboard, ...draft } : activeDashboard;
  const featured = dashboards[0];
  const questionMatches = questionFilter ? findQuestionMatches(dashboards, organizationId, questionFilter) : [];
  const filtered = discoverDashboards(dashboards, organizationId, search, dashboardOrder)
    .filter(item => !questionFilter || questionMatches.some(match => match.dashboard.id === item.id));
  const overviewMetrics = sampleOverview(period);
  const overviewIcons = [<BarChart3 size={20} />, <FolderKanban size={20} />, <Users size={20} />, <Activity size={20} />];
  const overviewColors = ['blue', 'violet', 'mint', 'peach'];

  const widgetDraftIssue = widgetDraft ? sampleConfigurationIssue(widgetDraft) : null;
  const widgetDraftProblem = widgetDraftIssue?.explanation ?? null;
  const supportedMetrics = widgetDraft && Array.isArray(metrics[widgetDraft.datasetKey]) ? metrics[widgetDraft.datasetKey] : [];
  const supportedDimension = widgetDraft && Object.hasOwn(dimensions, widgetDraft.datasetKey) ? dimensions[widgetDraft.datasetKey] : null;

  function selectVisualizationKind(kind: WidgetKind) {
    if (!widgetDraft) return;
    setWidgetDraft({ ...widgetDraft, kind, ...layoutForChangedKind(widgetDraft, kind), dimensionKey: supportedMetrics.length ? suggestedDimension(kind, widgetDraft.datasetKey, widgetDraft.metricKey) : widgetDraft.dimensionKey,
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
                  <div className="heading-left"><button className="back-button dashboard-return" aria-label="Back to dashboards" onClick={() => navigate('dashboards')}><ArrowLeft size={18} /><span>Dashboards</span></button>
                    <div><div className="eyebrow">DASHBOARD <span>·</span> {editMode ? 'EDITING DRAFT' : 'VIEWING SAVED'}</div>
                      {editMode && draft ? <input className="title-edit" aria-label="Dashboard name" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /> : <h1>{preview.name}</h1>}
                      {editMode && draft ? <input className="description-edit" aria-label="Dashboard description" value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /> : <p>{preview.description}</p>}</div>
                  </div>
                  <div className="heading-actions">
                    {editMode ? <>
                       {(Boolean(draft?.widgets.length) || undoHistory.past.length > 0 || undoHistory.future.length > 0) && <div className="dashboard-undo-controls" role="group" aria-label="Dashboard widget history">
                         <button type="button" className="button button-light" aria-label="Undo widget change" title="Undo widget change (Ctrl/Cmd+Z)" disabled={!undoHistory.past.length || saving} onClick={undoDashboardWidgets}><Undo2 size={16} /> Undo</button>
                         <button type="button" className="button button-light" aria-label="Redo widget change" title="Redo widget change (Ctrl/Cmd+Shift+Z or Ctrl+Y)" disabled={!undoHistory.future.length || saving} onClick={redoDashboardWidgets}><Redo2 size={16} /> Redo</button>
                       </div>}
                       <button className="button button-quiet" disabled={saving} onClick={stopEditing}>Cancel</button><button ref={saveChangesButton} className="button button-primary" disabled={!hasChanges || !draft?.name.trim() || saving || Boolean(dashboardConflict)} onClick={() => void saveDashboard()}><Check size={16} /> {saving ? 'Saving…' : 'Save changes'}</button></>
                      : <><button className="button button-light" onClick={() => share(preview)}><Share2 size={16} /> Share</button>{canEdit && <button className="button button-primary" onClick={() => startEditing()}><SlidersHorizontal size={16} /> Edit dashboard</button>}</>}
                  </div>
                </div>
                {editMode && <>{(Boolean(draft?.widgets.length) || hasChanges) && <div className="composition-status"><div><strong><SlidersHorizontal size={16} /> Composition mode</strong><span>Undo and Redo reverse widget edits in this tab. Save changes to keep your dashboard draft; library templates save separately.</span></div><span className={`draft-status ${hasChanges ? 'draft-dirty' : ''}`}>{hasChanges ? 'Unsaved changes' : 'No changes yet'}</span></div>}<span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{undoFeedback}</span></>}
                {saveError && editMode && <div role="alert" className="error-banner composition-error">{saveError} Your unsaved work is still available in this tab.</div>}
                {dashboardConflict && editMode && <section className="conflict-recovery" aria-label="Dashboard conflict recovery">
                  {dashboardConflict === 'unavailable'
                    ? <p>The latest dashboard could not be read with your current access. Keep this draft open and check access or try again.</p>
                    : <p>Opened at revision {activeDashboard?.revision}; latest saved revision {dashboardConflict.revision}: <strong>{dashboardConflict.name}</strong> ({dashboardConflict.widgets.length} visualizations). Your draft remains unchanged.</p>}
                  <div className="conflict-recovery-actions">
                    {dashboardConflict === 'unavailable'
                      ? <button type="button" className="button button-light" disabled={saving} onClick={() => void inspectCurrentDashboard()}>Check latest version</button>
                      : <button type="button" className="button button-light" disabled={saving} onClick={() => void reloadCurrentDashboard()}>Reload latest (discard draft)</button>}
                  </div>
                </section>}
                {!editMode && selectedTask?.organizationId === organizationId && selectedTask.dashboardId === preview.id
                  && <DashboardTaskGuide dashboard={preview} questionId={selectedTask.questionId} widgetId={selectedTask.widgetId} />}
                <DashboardConsumer key={`${organizationId}:${preview.id}`} widgets={preview.widgets} updatedAt={preview.updatedAt} editing={editMode} canEdit={canEdit} onStartEdit={() => startEditing(true)} onRepair={beginVisualizationRepair} onEdit={widget => beginWidgetEditor(widget)} onAdd={() => beginWidgetEditor(createWidget())}
                   onAddSaved={() => void openSavedLibrary()}
                   onDuplicate={widget => { if (draft) commitWidgets(duplicateWidget(draft.widgets, widget.id, crypto.randomUUID())); }}
                   onSaveToLibrary={offerSaveToLibrary} onChange={commitWidgets}
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
                <div className="list-toolbar">
                  <div className="list-search"><Search size={18} aria-hidden="true" /><input aria-label="Search dashboards" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or description" /></div>
                  <label className="catalog-sort">Sort dashboards
                    <select aria-label="Sort dashboards" value={dashboardOrder} onChange={event => setDashboardOrder(event.target.value as DiscoveryOrder)}>
                      <option value="recent">Recently updated</option>
                      <option value="name-asc">Name A–Z</option>
                      <option value="name-desc">Name Z–A</option>
                    </select>
                  </label>
                  <div className="list-count"><LayoutDashboard size={16} aria-hidden="true" /> {filtered.length} of {dashboards.length} dashboards</div>
                </div>
                {(search || questionFilter) && <div className="discovery-summary" role="status"><span>Showing {filtered.length} matching {filtered.length === 1 ? 'dashboard' : 'dashboards'}{questionFilter ? ` for “${businessQuestions.find(item => item.id === questionFilter)?.question}”` : ''}.</span><button type="button" className="text-link" onClick={() => { setSearch(''); setQuestionFilter(''); }}>Clear search and questions</button></div>}
                <div className="dashboard-cards">{filtered.map((item, index) => <article key={item.id} className="dashboard-card" data-dashboard-id={item.id}>
                  <button className={`dashboard-thumbnail thumbnail-${index % 3}`} onClick={() => openCatalogDashboard(item)} aria-label={`Open ${item.name} — Fictional sample preview`}>
                    <div className="thumbnail-bars">{[38, 62, 48, 82, 68, 95, 75, 100, 80, 92, 71, 98].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div>
                    <div className="thumbnail-float"><ShieldCheck size={14} /> Fictional sample</div>
                  </button>
                  <div className="dashboard-card-body">
                    <div className="dashboard-card-title"><h3 title={item.name}>{item.name}</h3><button className="icon-button" aria-label={`Share ${item.name}`} title="Review sharing context" onClick={() => share(item, undefined, { ...defaultConsumerFilters })}><Share2 size={16} /></button></div>
                    <p>{item.description || 'Your custom analytics workspace.'}</p>
                    <p className="dashboard-card-meta">Updated {savedDateLabel(item.updatedAt)} · Created by {item.createdBy || 'Unknown'}</p>
                    <div className="card-footer"><span><FileBarChart size={15} aria-hidden="true" /> {item.widgets.length} visuals</span>
                      <div className="catalog-card-actions">
                        <button onClick={() => openCatalogDashboard(item)}>View dashboard <ArrowRight size={14} aria-hidden="true" /></button>
                        {canEdit && <button className="catalog-delete" aria-label={`Delete ${item.name}`} onClick={() => void removeDashboard(item)}>Delete</button>}
                      </div>
                    </div>
                  </div>
                </article>)}
                  {canEdit && <button className="new-dashboard-card" onClick={() => { setDraft(emptyDraft()); setCreateOpen(true); }}><div><Plus size={26} /></div><strong>Create new dashboard</strong><p>Bring your data together in a new view.</p></button>}</div>
                {filtered.length === 0 && <div className="discovery-empty"><EmptyState title={dashboards.length === 0 ? 'No dashboards in this organization' : 'No matching dashboards'} message={dashboards.length === 0 ? canEdit ? 'Create a dashboard with sample visualizations to make a starting point available.' : 'Ask an organization editor to add a dashboard. There are no sample dashboards to explore yet.' : 'Try another business question, clear your search, or browse all dashboards.'} />{(search || questionFilter) && <button type="button" className="button button-light recovery-action" onClick={() => { setSearch(''); setQuestionFilter(''); }}>Show all dashboards</button>}</div>}
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
      {createOpen && draft && <ModalDialog title="Create dashboard" eyebrow="NEW WORKSPACE VIEW" description="Name your dashboard. It will be saved first, then open ready for visualizations." initialFocus="input" busy={creating} onDismiss={dismissCreateDashboard}>
        {createError && <p role="alert" className="error-banner">{createError}</p>}
        <label className="form-label">Dashboard name<input maxLength={100} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Customer health overview" /></label>
        <label className="form-label">Description<textarea maxLength={500} rows={3} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="What would you like your team to learn from this view?" /></label>
        <div className="modal-actions"><Button variant="light" disabled={creating} onClick={dismissCreateDashboard}>Cancel</Button><Button disabled={creating || !draft.name.trim()} onClick={() => void createDashboard()}>{creating ? 'Creating…' : 'Create dashboard'} <ArrowRight size={16} /></Button></div>
      </ModalDialog>}

      {libraryOpen && editMode && draft && <VisualizationLibraryPicker
        key={organizationId} organizationId={organizationId} items={library?.organizationId === organizationId ? library.items : []}
        context={libraryDiscovery} onContextChange={setLibraryDiscovery}
        loading={libraryLoading} error={libraryError} busy={libraryBusy}
        onRetry={() => void openSavedLibrary(true)} onDismiss={() => setLibraryOpen(false)}
        onCreate={() => { setLibraryOpen(false); beginWidgetEditor(createWidget(), null, true); }}
        onUse={useSavedVisualization} onEdit={editSavedVisualization} onDelete={saved => void deleteSavedVisualization(saved)} />}

      {librarySource && editMode && draft && <ModalDialog title="Save to visualization library" eyebrow="REUSABLE SAMPLE CHART"
        description="This template saves immediately and independently of dashboard Save or Cancel. Other dashboards remain unchanged."
        className="visualization-library-modal" initialFocus="input" busy={libraryBusy}
        onDismiss={() => { setLibrarySource(null); setLibraryError(''); }}>
        {libraryError && <p role="alert" className="error-banner">{libraryError}</p>}
        <label className="form-label">Visualization name<input maxLength={100} value={libraryName} onChange={event => setLibraryName(event.target.value)} /></label>
        <label className="form-label">Description<textarea maxLength={500} rows={3} value={librarySourceDescription} onChange={event => setLibrarySourceDescription(event.target.value)} /></label>
        <div className="modal-actions"><Button variant="light" disabled={libraryBusy} onClick={() => setLibrarySource(null)}>Cancel</Button><Button disabled={libraryBusy || !libraryName.trim()} onClick={() => void saveToLibrary()}>{libraryBusy ? 'Saving…' : 'Save to library'}</Button></div>
      </ModalDialog>}

      {widgetDraft && editMode && draft && <ModalDialog title={libraryEditing ? 'Edit saved visualization' : draft.widgets.some(item => item.id === widgetDraft.id) ? 'Edit dashboard visualization' : 'Configure visualization'}
        eyebrow="VISUALIZATION BUILDER · SAMPLE DATA"
        description={libraryEditing ? 'Save template updates this reusable library definition immediately. Existing dashboard copies remain unchanged.' : 'Apply the preview to this dashboard draft. Then choose Save changes on the dashboard to persist it.'}
        className="visualization-modal" initialFocus={widgetEditorInitialFocus.current} busy={libraryBusy}
        onDismiss={dismissVisualizationEditor}>
        <nav className="authoring-context" aria-label="Authoring location">
          <span>Dashboard draft</span><span aria-hidden="true">›</span>
          {libraryEditing ? <><span>Organization library</span><span aria-hidden="true">›</span><strong>Reusable template</strong></>
            : <strong>{draft.widgets.some(item => item.id === widgetDraft.id) ? 'Edit dashboard copy' : 'New dashboard visualization'}</strong>}
        </nav>
        <p className="authoring-persistence-note">{libraryEditing
          ? 'Save template writes to the library now; existing dashboard copies are not modified. Cancel returns to the library.'
          : 'Update visualization / Add to dashboard changes only the current draft. Dashboard Save changes is still required.'}</p>
        {widgetDraftIssue && <section className="visualization-repair-summary" data-repair-summary tabIndex={-1} role="group" aria-label="Configuration needs review">
          <strong>Configuration needs review</strong>
          <p id="visualization-repair-problem" role="alert">{widgetDraftIssue.explanation} The original saved values are retained until you choose replacements. Preview is unavailable and Update visualization is disabled until the configuration is valid.</p>
          {widgetDraftIssue.field === 'kind' && <p>Saved chart type: <code>{widgetDraft.kind}</code>. Changing the chart type is optional if the metric can instead be made compatible.</p>}
        </section>}
        <VisualizationGallery kind={widgetDraft.kind} onSelect={selectVisualizationKind} />
        {libraryEditing && <label className="form-label">Template description<textarea maxLength={500} rows={2}
          value={libraryDescription} onChange={event => setLibraryDescription(event.target.value)} /></label>}
        {libraryEditing && libraryError && <p role="alert" className="error-banner">{libraryError}</p>}
        {libraryEditing && templateConflict && <section className="conflict-recovery" aria-label="Template conflict recovery" tabIndex={-1}>
          {typeof templateConflict === 'string'
            ? <p>{templateConflict === 'deleted' ? 'This template no longer exists.' : 'The latest template could not be checked with your current access.'} Your unsaved editor fields are still visible.</p>
            : <p>Opened at revision {libraryEditing.revision}; latest revision {templateConflict.revision}: <strong>{templateConflict.definition.title}</strong>. Existing dashboard copies are unaffected.</p>}
          <button type="button" className="button button-light" disabled={libraryBusy} onClick={reopenCurrentTemplate}>
            {typeof templateConflict === 'string' ? 'Return to library (discard edits)' : 'Reopen latest template (discard edits)'}
          </button>
        </section>}
        <div className="visualization-workspace">
          <div className="visualization-settings">
        <label className="form-label">Title<input maxLength={100} value={widgetDraft.title} onChange={event => setWidgetDraft({ ...widgetDraft, title: event.target.value })} /></label>
        <section className="visualization-data-fields" aria-label="Data and measures">
          <h2>Data and measures</h2>
          <p>Choose an existing fictional sample dataset and measure. Only supported field combinations are available.</p>
        <label className="form-label">Dataset<select value={widgetDraft.datasetKey} aria-invalid={widgetDraftIssue?.field === 'dataset' || undefined} aria-describedby={widgetDraftIssue?.field === 'dataset' ? 'visualization-repair-problem' : undefined} onChange={event => { const datasetKey = event.target.value as DatasetKey; const metricKey = metrics[datasetKey][0]?.key ?? 'orders'; setWidgetDraft({ ...widgetDraft, datasetKey, metricKey, dimensionKey: suggestedDimension(widgetDraft.kind, datasetKey, metricKey), appearance: compatibleAppearance(widgetDraft.appearance, widgetDraft.kind, datasetKey) }); }}>
          {!datasetOptions.some(item => item.key === widgetDraft.datasetKey) && <option value={widgetDraft.datasetKey}>Unsupported saved source: {widgetDraft.datasetKey}</option>}
          {datasetOptions.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        {!datasetOptions.some(item => item.key === widgetDraft.datasetKey) && <p className="visualization-saved-key">Original saved source key: <code>{widgetDraft.datasetKey}</code></p>}
        <label className="form-label">{widgetDraft.kind === 'scatter' ? 'Vertical measure' : 'Metric'}<select value={widgetDraft.metricKey} aria-invalid={widgetDraftIssue?.field === 'metric' || undefined} aria-describedby={widgetDraftIssue?.field === 'metric' ? 'visualization-repair-problem' : undefined} onChange={event => { const metricKey = event.target.value; setWidgetDraft({ ...widgetDraft, metricKey, dimensionKey: widgetDraft.kind === 'scatter' && widgetDraft.dimensionKey === metricKey ? suggestedDimension('scatter', widgetDraft.datasetKey, metricKey) : widgetDraft.dimensionKey }); }}>
          {!supportedMetrics.some(item => item.key === widgetDraft.metricKey) && <option value={widgetDraft.metricKey}>Unsupported saved metric: {widgetDraft.metricKey}</option>}
          {supportedMetrics.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        {!supportedMetrics.some(item => item.key === widgetDraft.metricKey) && <p className="visualization-saved-key">Original saved metric key: <code>{widgetDraft.metricKey}</code></p>}
        {widgetDraft.kind === 'scatter' && <label className="form-label">Horizontal measure<select value={widgetDraft.dimensionKey} aria-invalid={widgetDraftIssue?.field === 'dimension' || undefined} aria-describedby={widgetDraftIssue?.field === 'dimension' ? 'visualization-repair-problem' : undefined} onChange={event => setWidgetDraft({ ...widgetDraft, dimensionKey: event.target.value })}>
          {!supportedMetrics.some(item => item.key === widgetDraft.dimensionKey && item.key !== widgetDraft.metricKey) && <option value={widgetDraft.dimensionKey}>Unsupported saved horizontal measure: {widgetDraft.dimensionKey}</option>}
          {supportedMetrics.filter(item => item.key !== widgetDraft.metricKey).map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        {!supportedMetrics.some(item => item.key === widgetDraft.dimensionKey && item.key !== widgetDraft.metricKey) && <p className="visualization-saved-key">Original saved horizontal measure key: <code>{widgetDraft.dimensionKey}</code></p>}}
        {widgetDraft.kind !== 'scatter' && <div className="visualization-dimension">
          <strong>Dimension:</strong> {widgetDraft.dimensionKey}
          {widgetDraftIssue?.field === 'dimension' && supportedDimension && <button type="button" className="widget-recovery" aria-describedby="visualization-repair-problem" onClick={() => setWidgetDraft({ ...widgetDraft, dimensionKey: supportedDimension })}>Use supported dimension: {supportedDimension}</button>}
        </div>}
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
          </div>
        <section className="visualization-preview" aria-label="Live visualization preview">
          <h2>Live preview</h2><p>Original fictional sample records only. This preview does not save changes or query a customer data source.</p>
          <WidgetTile widget={widgetDraft} period="12m" preview />
        </section>
        </div>

        <div className="modal-actions"><Button variant="light" disabled={libraryBusy} onClick={dismissVisualizationEditor}>Cancel</Button><Button disabled={libraryBusy || Boolean(templateConflict) || !widgetDraft.title.trim() || Boolean(widgetDraftProblem)} onClick={() => void finishWidgetEdit()}><Check size={16} /> {libraryEditing ? (libraryBusy ? 'Saving…' : 'Save template') : draft.widgets.some(item => item.id === widgetDraft.id) ? 'Update visualization' : 'Add to dashboard'}</Button></div>
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
