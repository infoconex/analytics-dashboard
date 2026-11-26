import { useEffect, useRef } from 'react';
import type { SavedVisualization, WidgetKind } from './model';
import { visualizations } from './demoData';
import { discoverVisualizations, savedDateLabel, type DiscoveryOrder } from './contentDiscovery';
import { ModalDialog } from './ui/ModalDialog';
import { WidgetTile } from './WidgetTile';
import { isQueryWidget } from './queryVisualization';
import { Button } from './ui/Button';

export interface LibraryDiscoveryContext {
  search: string;
  kind: WidgetKind | 'all';
  order: DiscoveryOrder;
  previewId: string | null;
}

export const initialLibraryDiscoveryContext: LibraryDiscoveryContext = {
  search: '', kind: 'all', order: 'recent', previewId: null,
};

interface Props {
  context: LibraryDiscoveryContext;
  onContextChange: (next: LibraryDiscoveryContext) => void;
  organizationId: string;
  items: SavedVisualization[];
  loading: boolean;
  error: string;
  busy: boolean;
  onDismiss: () => void;
  onRetry: () => void;
  onCreate: () => void;
  onUse: (saved: SavedVisualization) => void;
  onEdit: (saved: SavedVisualization) => void;
  onDelete: (saved: SavedVisualization) => void;
}

export function VisualizationLibraryPicker({ context, onContextChange, organizationId, items, loading, error, busy, onDismiss, onRetry, onCreate, onUse, onEdit, onDelete }: Props) {
  const { search, kind, order, previewId } = context;
  const searchInput = useRef<HTMLInputElement>(null);
  const previewPanel = useRef<HTMLElement>(null);
  // Data arrives after showModal, so focus Search when the input mounts.
  useEffect(() => {
    if (!loading) searchInput.current?.focus();
  }, [loading]);
  // Expanding a large preview inside a narrow, scrollable dialog must reveal
  // its heading without stealing keyboard focus from the Preview toggle.
  useEffect(() => {
    if (!previewId) return;
    // Scroll just the preview heading, not the entire (potentially tall)
    // chart panel. Scrolling the whole panel pushes the focused Preview toggle
    // and the dialog's Close control out of view on narrow screens.
    const frame = window.requestAnimationFrame(() =>
      previewPanel.current?.querySelector('h3')?.scrollIntoView({ block: 'nearest', behavior: 'instant' }));
    return () => window.cancelAnimationFrame(frame);
  }, [previewId]);
  // The API returns only authorized organization-scoped items. Recheck scope in
  // the client to prevent a stale/malformed response from being shown or used.
  const scoped = items.filter(item => item.organizationId === organizationId);
  const visible = discoverVisualizations(scoped, organizationId, search, kind, order);
  const filtersActive = Boolean(search.trim()) || kind !== 'all';

  function resetFilters() {
    onContextChange({ ...context, search: '', kind: 'all', previewId: null });
    searchInput.current?.focus();
  }

  return <ModalDialog title="Add saved visualization" eyebrow="ORGANIZATION LIBRARY · SAMPLE DATA"
    description="Use an independent copy of a saved chart. Editing this dashboard will not change the library or other dashboards."
    initialFocus=".library-search" onDismiss={onDismiss} busy={busy} className="visualization-library-modal">
    <div className="library-topline">
      <Button variant="light" className="library-create" onClick={onCreate} disabled={busy}>Create new instead</Button>
      <p>Only visualizations saved in this organization are listed.</p>
    </div>
    {error && <div role="alert" className="error-banner">{error} <button type="button" onClick={onRetry} disabled={busy}>Retry</button></div>}
    {loading ? <p role="status">Loading saved visualizations…</p> : <>
      <div className="library-filters">
        <label className="form-label">Search saved visualizations
          <input className="library-search" ref={searchInput} value={search} onChange={event => onContextChange({ ...context, search: event.target.value, previewId: null })} placeholder="Search by name or description" /></label>
        <label className="form-label">Visualization type
          <select value={kind} onChange={event => onContextChange({ ...context, kind: event.target.value as WidgetKind | 'all', previewId: null })}>
            <option value="all">All types</option>
            {visualizations.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select></label>
        <label className="form-label">Sort saved visualizations
          <select value={order} onChange={event => onContextChange({ ...context, order: event.target.value as DiscoveryOrder, previewId: null })}>
            <option value="recent">Recently updated</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
          </select></label>
      </div>
      {(!error || scoped.length > 0) && <div className="library-results-summary">
        <p role="status">Showing {visible.length} of {scoped.length} saved {scoped.length === 1 ? 'visualization' : 'visualizations'}</p>
        {filtersActive && <button type="button" className="text-link" onClick={resetFilters}>Clear filters</button>}
      </div>}
      {scoped.length === 0 && !error && <div className="library-empty"><strong>No saved visualizations yet</strong><p>Create a chart on a dashboard, then choose Save to library to make it reusable.</p><Button onClick={onCreate}>Create visualization</Button></div>}
      {scoped.length > 0 && visible.length === 0 && <div className="library-empty"><strong>No matching saved visualizations</strong><p>Try another name or visualization type, or clear the filters to see all templates.</p><button type="button" className="button button-light" onClick={resetFilters}>Show all visualizations</button></div>}
      {visible.length > 0 && <div className="library-items" aria-label="Saved visualization choices">
        {visible.map(item => <div className="library-result" key={item.id}>
          <article className="library-item">
            <div className="library-item-details">
              <h3 title={item.definition.title}>{item.definition.title}</h3>
              <p className="library-item-kind">{visualizations.find(v => v.key === item.definition.kind)?.label ?? item.definition.kind} · {isQueryWidget(item.definition) ? 'Fictional raw records' : item.definition.datasetKey === 'commerce' ? 'Commerce performance' : 'Marketing channels'}</p>
              {item.description && <p>{item.description}</p>}
              <p className="library-item-meta">Updated {savedDateLabel(item.updatedAt)} · Created by {item.createdBy || 'Unknown'}</p>
            </div>
            <div className="library-item-actions">
              <Button disabled={busy} onClick={() => onUse(item)}>Add copy</Button>
              <button type="button" onClick={() => onContextChange({ ...context, previewId: previewId === item.id ? null : item.id })}
                aria-expanded={previewId === item.id} disabled={busy}>Preview</button>
              <button type="button" onClick={() => onEdit(item)} disabled={busy}>Edit template</button>
              <button type="button" onClick={() => onDelete(item)} disabled={busy}>Delete template</button>
            </div>
          </article>
          {previewId === item.id && <section ref={previewPanel} className="library-preview" aria-label="Saved visualization preview">
            <h3>Preview: {item.definition.title}</h3>
            <WidgetTile widget={item.definition} period="12m" preview />
            <p>Preview of this library template using fictional sample records. Add copy creates an independent dashboard instance.</p>
          </section>}
        </div>)}
      </div>}
    </>}
    <div className="modal-actions library-close-footer"><Button variant="light" onClick={onDismiss} disabled={busy}>Close library</Button></div>
  </ModalDialog>;
}
