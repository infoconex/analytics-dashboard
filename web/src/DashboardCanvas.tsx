import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Plus } from 'lucide-react';
import { moveWidget, reorderWidgets } from './composition';
import type { DashboardWidget } from './model';
import { WidgetTile } from './WidgetTile';
import type { ConsumerFilters } from './consumerFilters';
import { Button } from './ui/Button';

interface Props {
  widgets: DashboardWidget[];
  filters: ConsumerFilters;
  editing: boolean;
  canEdit: boolean;
  onStartEdit: () => void;
  onChange: (widgets: DashboardWidget[]) => void;
  onEdit: (widget: DashboardWidget) => void;
  onAdd: () => void;
  onChannelSelect: (channel: string) => void;
}

export function DashboardCanvas({ widgets, filters, editing, canEdit, onStartEdit, onChange, onEdit, onAdd, onChannelSelect }: Props) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const activePointer = useRef<string | null>(null);
  const indexRef = useRef<HTMLDetailsElement>(null);
  const indexButtons = useRef(new Map<string, HTMLButtonElement>());

  function widgetAtPoint(x: number, y: number): string | null {
    return document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-widget-id]')?.dataset.widgetId ?? null;
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

  function focusWidget(id: string) {
    const heading = document.getElementById(`widget-heading-${id}`);
    heading?.scrollIntoView({ block: 'start', behavior: 'instant' });
    heading?.focus({ preventScroll: true });
  }

  function returnToIndex(id: string) {
    if (!indexRef.current) return;
    indexRef.current.open = true;
    const target = indexButtons.current.get(id);
    target?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    target?.focus({ preventScroll: true });
  }

  return (
    <section aria-label={editing ? 'Dashboard composition canvas' : 'Dashboard visualizations'}>
      {editing && <p className="canvas-instructions" id="canvas-instructions">Drag a handle to rearrange visualizations, or use the Move earlier and Move later buttons. The handle also supports the up and down arrow keys. Changes are saved only when you select Save changes.</p>}
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
          <WidgetTile widget={widget} position={index + 1} total={widgets.length} period={filters.period} filters={filters} editing={editing} onEdit={onEdit} onRemove={id => onChange(widgets.filter(item => item.id !== id))} onChannelSelect={!editing && widget.datasetKey === 'channels' ? onChannelSelect : undefined}
            onReturnToIndex={!editing && widgets.length >= 8 ? () => returnToIndex(widget.id) : undefined} />
        </div>)}
        {editing && <button className="add-widget" onClick={onAdd}><span><Plus size={25} /></span><strong>Add visualization</strong><small>Choose a chart and see it on your dashboard</small></button>}
      </div>
      {widgets.length === 0 && !editing && <div className="canvas-empty"><strong>No visualizations yet</strong><p>{canEdit ? 'Start with a sample chart, then arrange your dashboard.' : 'An editor can add the first visualization to this dashboard.'}</p>{canEdit && <Button onClick={onStartEdit}><Plus size={17} aria-hidden="true" /> Add first visualization</Button>}</div>}
      {widgets.length === 0 && editing && <p className="canvas-empty-hint">Your canvas is ready. Select Add visualization to start with a sample chart.</p>}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
    </section>
  );
}
