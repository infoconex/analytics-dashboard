import { useState } from 'react';
import type { SavedVisualization, WidgetKind } from './model';
import { visualizations } from './demoData';
import { ModalDialog } from './ui/ModalDialog';
import { WidgetTile } from './WidgetTile';
import { Button } from './ui/Button';

interface Props {
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

export function VisualizationLibraryPicker({ items, loading, error, busy, onDismiss, onRetry, onCreate, onUse, onEdit, onDelete }: Props) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<WidgetKind | 'all'>('all');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const visible = items.filter(item => (kind === 'all' || item.definition.kind === kind)
    && `${item.definition.title} ${item.description}`.toLowerCase().includes(search.toLowerCase().trim()));
  const active = visible.find(item => item.id === previewId) ?? null;

  return <ModalDialog title="Add saved visualization" eyebrow="ORGANIZATION LIBRARY · SAMPLE DATA"
    description="Use an independent copy of a saved chart. Editing this dashboard will not change the library or other dashboards."
    initialFocus=".library-create" onDismiss={onDismiss} busy={busy} className="visualization-library-modal">
    <div className="library-topline">
      <Button variant="light" className="library-create" onClick={onCreate} disabled={busy}>Create new instead</Button>
      <p>Only visualizations saved in this organization are listed.</p>
    </div>
    {error && <div role="alert" className="error-banner">{error} <button type="button" onClick={onRetry} disabled={busy}>Retry</button></div>}
    {loading ? <p role="status">Loading saved visualizations…</p> : <>
      <div className="library-filters">
        <label className="form-label">Search saved visualizations
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name or description" /></label>
        <label className="form-label">Visualization type
          <select value={kind} onChange={event => setKind(event.target.value as WidgetKind | 'all')}>
            <option value="all">All types</option>
            {visualizations.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select></label>
      </div>
      {items.length === 0 && !error && <div className="library-empty"><strong>No saved visualizations yet</strong><p>Create a chart on a dashboard, then choose Save to library to make it reusable.</p><Button onClick={onCreate}>Create visualization</Button></div>}
      {items.length > 0 && visible.length === 0 && <div className="library-empty">No saved visualizations match your search. Clear the filters to browse all charts.</div>}
      {visible.length > 0 && <div className="library-items" aria-label="Saved visualization choices">
        {visible.map(item => <article key={item.id} className="library-item">
          <div><h3>{item.definition.title}</h3><p>{item.definition.kind} · {item.definition.datasetKey === 'commerce' ? 'Commerce performance' : 'Marketing channels'}</p>
            {item.description && <p>{item.description}</p>}</div>
          <div className="library-item-actions">
            <Button disabled={busy} onClick={() => onUse(item)}>Add copy</Button>
            <button type="button" onClick={() => setPreviewId(previewId === item.id ? null : item.id)}
              aria-expanded={previewId === item.id} disabled={busy}>Preview</button>
            <button type="button" onClick={() => onEdit(item)} disabled={busy}>Edit template</button>
            <button type="button" onClick={() => onDelete(item)} disabled={busy}>Delete template</button>
          </div>
        </article>)}
      </div>}
      {active && <section className="library-preview" aria-label="Saved visualization preview">
        <h3>Preview: {active.definition.title}</h3>
        <WidgetTile widget={active.definition} period="12m" preview />
        <p>Only original fictional sample records are shown.</p>
      </section>}
    </>}
    <div className="modal-actions library-close-footer"><Button variant="light" onClick={onDismiss} disabled={busy}>Close library</Button></div>
  </ModalDialog>;
}
