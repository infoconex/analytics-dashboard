import { useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Plus } from 'lucide-react';
import { layoutForWidget, moveWidget, reorderWidgets, resizeWidget, type WidgetLayout } from './composition';
import type { DashboardWidget } from './model';
import { WidgetTile } from './WidgetTile';
import type { ConsumerFilters } from './consumerFilters';
import { Button } from './ui/Button';
import { resolveNavigationSelection } from './dashboardNavigation';

interface Props {
  widgets: DashboardWidget[];
  filters: ConsumerFilters;
  editing: boolean;
  canEdit: boolean;
  onStartEdit: () => void;
  onChange: (widgets: DashboardWidget[]) => void;
  onEdit: (widget: DashboardWidget) => void;
  onAdd: () => void;
  onAddSaved: () => void;
  onDuplicate: (widget: DashboardWidget) => void;
  onSaveToLibrary: (widget: DashboardWidget) => void;
  onChannelSelect: (channel: string) => void;
  onShareInsight?: (widget: DashboardWidget) => void;
}

export function DashboardCanvas({ widgets, filters, editing, canEdit, onStartEdit, onChange, onEdit, onAdd, onAddSaved, onDuplicate, onSaveToLibrary, onChannelSelect, onShareInsight }: Props) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [navigationSelection, setNavigationSelection] = useState('');
  const selectedTarget = resolveNavigationSelection(widgets, navigationSelection);
  const activePointer = useRef<string | null>(null);
  const resizingPointer = useRef<{ id: string; x: number; y: number; columns: WidgetLayout['columns']; height: number; gridWidth: number; next: WidgetLayout } | null>(null);
  const [resizePreview, setResizePreview] = useState<({ id: string } & WidgetLayout) | null>(null);
  const indexRef = useRef<HTMLDetailsElement>(null);
  const indexButtons = useRef(new Map<string, HTMLButtonElement>());

  function widgetAtPoint(x: number, y: number): string | null {
    const exact = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-widget-id]')?.dataset.widgetId;
    if (exact) return exact;
    // Dragging across grid gaps should still yield a predictable drop target.
    const cards = [...document.querySelectorAll<HTMLElement>('.widgets-grid [data-widget-id]')];
    return cards.reduce<{ id: string; distance: number } | null>((nearest, element) => {
      const bounds = element.getBoundingClientRect();
      const distance = (x - (bounds.left + bounds.right) / 2) ** 2 + (y - (bounds.top + bounds.bottom) / 2) ** 2;
      return !nearest || distance < nearest.distance ? { id: element.dataset.widgetId!, distance } : nearest;
    }, null)?.id ?? null;
  }

  function clearPointer() {
    activePointer.current = null;
    setDragged(null);
    setOver(null);
  }

  function announceMove(next: DashboardWidget[], id: string) {
    if (next === widgets) return;
    onChange(next);
    const position = next.findIndex(item => item.id === id) + 1;
    const moved = next[position - 1];
    if (moved) setAnnouncement(`${moved.title} moved to position ${position} of ${next.length}.`);
  }

  function announceResize(widget: DashboardWidget, columns: number, height: number) {
    const next = resizeWidget(widgets, widget.id, columns, height);
    if (next === widgets) return;
    onChange(next);
    const dimensions = layoutForWidget(next.find(item => item.id === widget.id)!);
    setAnnouncement(`${widget.title} resized to ${dimensions.columns} of 12 columns and ${dimensions.height} pixels tall.`);
  }

  function stopResizing() {
    resizingPointer.current = null;
    setResizePreview(null);
  }

  function focusWidget(id: string) {
    const heading = document.getElementById(`widget-heading-${id}`);
    // Center the destination in the usable viewport: at high browser zoom the
    // sticky top bar can obscure a heading aligned to the document's top.
    heading?.scrollIntoView({ block: 'center', behavior: 'instant' });
    heading?.focus({ preventScroll: true });
  }

  function returnToIndex(id: string) {
    if (!indexRef.current) return;
    indexRef.current.open = true;
    const target = indexButtons.current.get(id);
    target?.scrollIntoView({ block: 'center', behavior: 'instant' });
    target?.focus({ preventScroll: true });
  }

  return (
    <section aria-label={editing ? 'Dashboard composition canvas' : 'Dashboard visualizations'}>
      {editing && <p className="canvas-instructions" id="canvas-instructions">Drag the Move handle to reorder, or use Move earlier/later. Drag the lower-right Resize handle to adjust width and height, or use its arrow keys. Changes take effect only when you select Save changes.</p>}
      {widgets.length >= 8 && <nav className="dashboard-navigator" aria-label="Find a visualization">
        <div className="dashboard-navigator-copy"><h2>Find a visualization</h2><p>{widgets.length} visualizations. Choose one to jump directly to its heading, or browse the full list below.</p></div>
        <form className="dashboard-navigator-controls" onSubmit={event => { event.preventDefault(); if (selectedTarget) focusWidget(selectedTarget); }}>
          <label htmlFor="dashboard-navigator-selection">Visualization</label>
          <div className="dashboard-navigator-actions">
            <select id="dashboard-navigator-selection" aria-label="Find a visualization" value={selectedTarget ?? ''} onChange={event => setNavigationSelection(event.target.value)}>
              <option value="">Choose a visualization…</option>
              {widgets.map((widget, index) => <option key={widget.id} value={widget.id}>{index + 1}. {widget.title}</option>)}
            </select>
            <Button type="submit" disabled={!selectedTarget}>Go to visualization</Button>
          </div>
        </form>
      </nav>}
      {widgets.length >= 8 && <details className="dashboard-index" ref={indexRef}>
        <summary>Jump to visualization <span className="dashboard-index-count">({widgets.length})</span></summary>
        <nav aria-label="Jump to visualization">
          <ol>{widgets.map((widget, index) => <li key={widget.id}>
            <button type="button" ref={node => {
              if (node) indexButtons.current.set(widget.id, node);
              else indexButtons.current.delete(widget.id);
            }} onClick={() => focusWidget(widget.id)} aria-label={`${index + 1}. ${widget.title}`}>
              <span aria-hidden="true">{index + 1}.</span> {widget.title}
            </button>
          </li>)}</ol>
        </nav>
      </details>}
      <div className={`widgets-grid ${editing ? 'widgets-grid-editing' : ''}`}>
        {widgets.map((widget, index) => <div
          key={widget.id}
          data-widget-id={widget.id}
          className={`canvas-item canvas-item-${widget.kind} ${over === widget.id && dragged !== widget.id ? 'canvas-drop-target' : ''}`}
          style={{
            '--widget-columns': resizePreview?.id === widget.id ? resizePreview.columns : layoutForWidget(widget).columns,
            '--widget-height': `${resizePreview?.id === widget.id ? resizePreview.height : layoutForWidget(widget).height}px`,
          } as CSSProperties}
          >
          {editing && <div className="canvas-move-controls">
            <button
              type="button" className="drag-handle" aria-label={`Drag to move ${widget.title}`}
              aria-describedby="canvas-instructions" title="Drag or press arrow keys to rearrange"
              onPointerDown={event => {
                if (event.button !== 0) return;
                activePointer.current = widget.id;
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragged(widget.id);
                event.preventDefault();
              }}
              onPointerMove={event => {
                if (activePointer.current !== widget.id) return;
                const target = widgetAtPoint(event.clientX, event.clientY);
                setOver(target !== widget.id ? target : null);
              }}
              onPointerUp={event => {
                if (activePointer.current !== widget.id) return;
                const target = widgetAtPoint(event.clientX, event.clientY);
                if (target) announceMove(reorderWidgets(widgets, widget.id, target), widget.id);
                clearPointer();
              }}
              onPointerCancel={clearPointer}
              onKeyDown={event => {
                const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : null;
                if (!direction) return;
                event.preventDefault();
                announceMove(moveWidget(widgets, widget.id, direction), widget.id);
              }}><GripVertical size={18} /> <span>Drag</span></button>
            <span className="canvas-position">{index + 1} / {widgets.length}</span>
            <button className="icon-button" aria-label={`Move ${widget.title} earlier`} title="Move earlier" disabled={index === 0} onClick={() => announceMove(moveWidget(widgets, widget.id, -1), widget.id)}><ArrowUp size={17} /></button>
            <button className="icon-button" aria-label={`Move ${widget.title} later`} title="Move later" disabled={index === widgets.length - 1} onClick={() => announceMove(moveWidget(widgets, widget.id, 1), widget.id)}><ArrowDown size={17} /></button>
          </div>}
          <WidgetTile widget={widget} position={index + 1} total={widgets.length} period={filters.period} filters={filters} editing={editing} onEdit={onEdit} onDuplicate={onDuplicate} onSaveToLibrary={onSaveToLibrary} onRemove={id => onChange(widgets.filter(item => item.id !== id))} onChannelSelect={!editing && widget.datasetKey === 'channels' ? onChannelSelect : undefined}
            onReturnToIndex={!editing && widgets.length >= 8 ? () => returnToIndex(widget.id) : undefined}
            onShareInsight={!editing ? onShareInsight : undefined} />
          {editing && <button type="button" className="resize-handle"
            aria-label={`Resize ${widget.title}: ${resizePreview?.id === widget.id ? resizePreview.columns : layoutForWidget(widget).columns} of 12 columns, ${resizePreview?.id === widget.id ? resizePreview.height : layoutForWidget(widget).height} pixels tall. Arrow keys adjust size`}
            aria-describedby="canvas-instructions" title="Drag to resize; arrow keys adjust width and height"
            onPointerDown={event => {
              if (event.button !== 0) return;
              const size = layoutForWidget(widget);
              const grid = event.currentTarget.closest<HTMLElement>('.widgets-grid');
              resizingPointer.current = { id: widget.id, x: event.clientX, y: event.clientY,
                columns: size.columns, height: size.height, gridWidth: grid?.getBoundingClientRect().width ?? 1200, next: size };
              event.currentTarget.setPointerCapture(event.pointerId);
              event.preventDefault();
            }}
            onPointerMove={event => {
              const current = resizingPointer.current;
              if (!current || current.id !== widget.id) return;
              const columnStep = Math.round((event.clientX - current.x) / Math.max(80, current.gridWidth / 4));
              const heightStep = Math.round((event.clientY - current.y) / 20);
              const minimumColumns = widget.kind === 'metric' ? 3 : 6;
              const minimumHeight = widget.kind === 'metric' || widget.kind === 'table' ? 220 : 320;
              const columns = Math.max(minimumColumns, Math.min(12, current.columns + columnStep * 3)) as WidgetLayout['columns'];
              const height = Math.max(minimumHeight, Math.min(640, current.height + heightStep * 20));
              current.next = { columns, height };
              setResizePreview({ id: widget.id, columns, height });
            }}
            onPointerUp={() => {
              const current = resizingPointer.current;
              if (!current || current.id !== widget.id) return;
              announceResize(widget, current.next.columns, current.next.height);
              stopResizing();
            }}
            onPointerCancel={stopResizing}
            onKeyDown={event => {
              const current = layoutForWidget(widget);
              const shortcuts: Record<string, [number, number]> = {
                ArrowLeft: [current.columns - 3, current.height],
                ArrowRight: [current.columns + 3, current.height],
                ArrowUp: [current.columns, current.height - 40],
                ArrowDown: [current.columns, current.height + 40],
              };
              const next = shortcuts[event.key];
              if (!next) return;
              event.preventDefault();
              announceResize(widget, next[0]!, next[1]!);
            }}><span aria-hidden="true">↘</span><span className="sr-only">Resize widget</span></button>}
        </div>)}
        {editing && <button className="add-widget" onClick={onAdd}><span><Plus size={25} /></span><strong>Add visualization</strong><small>Create a chart and see it on your dashboard</small></button>}
        {editing && <button type="button" className="add-widget add-saved-widget" onClick={onAddSaved}><span><Plus size={25} /></span><strong>Add saved visualization</strong><small>Reuse a chart from this organization</small></button>}
      </div>
      {widgets.length === 0 && !editing && <div className="canvas-empty"><strong>No visualizations yet</strong><p>{canEdit ? 'Start with a sample chart, then arrange your dashboard.' : 'An editor can add the first visualization to this dashboard.'}</p>{canEdit && <Button onClick={onStartEdit}><Plus size={17} aria-hidden="true" /> Add first visualization</Button>}</div>}
      {widgets.length === 0 && editing && <p className="canvas-empty-hint">Your canvas is ready. Select Add visualization to start with a sample chart.</p>}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
    </section>
  );
}
