import { useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Plus } from 'lucide-react';
import { moveWidget, reorderWidgets } from './composition';
import type { DashboardWidget } from './model';
import { WidgetTile } from './WidgetTile';

interface Props {
  widgets: DashboardWidget[];
  period: string;
  editing: boolean;
  onChange: (widgets: DashboardWidget[]) => void;
  onEdit: (widget: DashboardWidget) => void;
  onAdd: () => void;
}

export function DashboardCanvas({ widgets, period, editing, onChange, onEdit, onAdd }: Props) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  function announceMove(next: DashboardWidget[], id: string) {
    if (next === widgets) return;
    onChange(next);
    const position = next.findIndex(item => item.id === id) + 1;
    const moved = next[position - 1];
    if (moved) setAnnouncement(`${moved.title} moved to position ${position} of ${next.length}.`);
  }

  return (
    <section aria-label={editing ? 'Dashboard composition canvas' : 'Dashboard visualizations'}>
      {editing && <p className="canvas-instructions" id="canvas-instructions">Drag a handle to rearrange visualizations, or use the Move earlier and Move later buttons. Changes are saved only when you select Save changes.</p>}
      <div className={`widgets-grid ${editing ? 'widgets-grid-editing' : ''}`}>
        {widgets.map((widget, index) => <div
          key={widget.id}
          className={`canvas-item ${over === widget.id && dragged !== widget.id ? 'canvas-drop-target' : ''}`}
          onDragOver={event => { if (!editing || !dragged || dragged === widget.id) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setOver(widget.id); }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(null); }}
          onDrop={event => {
            event.preventDefault();
            const source = event.dataTransfer.getData('text/plain');
            if (editing && source === dragged) announceMove(reorderWidgets(widgets, source, widget.id), source);
            setDragged(null);
            setOver(null);
          }}>
          {editing && <div className="canvas-move-controls">
            <button
              className="drag-handle" draggable aria-label={`Drag to move ${widget.title}`}
              aria-describedby="canvas-instructions" title="Drag to rearrange"
              onDragStart={event => { event.dataTransfer.setData('text/plain', widget.id); event.dataTransfer.effectAllowed = 'move'; setDragged(widget.id); }}
              onDragEnd={() => { setDragged(null); setOver(null); }}><GripVertical size={18} /> <span>Drag</span></button>
            <span className="canvas-position">{index + 1} / {widgets.length}</span>
            <button className="icon-button" aria-label={`Move ${widget.title} earlier`} title="Move earlier" disabled={index === 0} onClick={() => announceMove(moveWidget(widgets, widget.id, -1), widget.id)}><ArrowUp size={17} /></button>
            <button className="icon-button" aria-label={`Move ${widget.title} later`} title="Move later" disabled={index === widgets.length - 1} onClick={() => announceMove(moveWidget(widgets, widget.id, 1), widget.id)}><ArrowDown size={17} /></button>
          </div>}
          <WidgetTile widget={widget} period={period} editing={editing} onEdit={onEdit} onRemove={id => onChange(widgets.filter(item => item.id !== id))} />
        </div>)}
        {editing && <button className="add-widget" onClick={onAdd}><span><Plus size={25} /></span><strong>Add visualization</strong><small>Choose a chart and see it on your dashboard</small></button>}
      </div>
      {widgets.length === 0 && !editing && <div className="canvas-empty"><strong>No visualizations yet</strong><p>An editor can add the first visualization to this dashboard.</p></div>}
      {widgets.length === 0 && editing && <p className="canvas-empty-hint">Your canvas is ready. Select Add visualization to start with a sample chart.</p>}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
    </section>
  );
}
