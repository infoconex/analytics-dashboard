import { useState } from 'react';
import { Clock3 } from 'lucide-react';
import { DashboardCanvas } from './DashboardCanvas';
import { DashboardFiltersBar } from './DashboardFiltersBar';
import { defaultConsumerFilters, toggleChannel } from './consumerFilters';
import { summarizeSampleAvailability } from './sampleAvailability';
import type { ConsumerFilters } from './consumerFilters';
import type { DashboardWidget } from './model';

interface Props {
  widgets: DashboardWidget[];
  updatedAt: string;
  editing: boolean;
  canEdit: boolean;
  onStartEdit: () => void;
  onChange: (widgets: DashboardWidget[]) => void;
  onEdit: (widget: DashboardWidget) => void;
  onAdd: () => void;
  onAddSaved: () => void;
  onDuplicate: (widget: DashboardWidget) => void;
  onSaveToLibrary: (widget: DashboardWidget) => void;
  onFiltersChange?: (filters: ConsumerFilters) => void;
  initialFilters?: ConsumerFilters;
  onShareInsight?: (widget: DashboardWidget, filters: ConsumerFilters) => void;
}

// Mount with a dashboard-and-organization key to keep unsaved consumer filters
// scoped to one open dashboard, not to a link or server-persisted draft.
export function DashboardConsumer({ widgets, updatedAt, editing, canEdit, onStartEdit, onChange, onEdit, onAdd, onAddSaved, onDuplicate, onSaveToLibrary, onFiltersChange, onShareInsight, initialFilters }: Props) {
  const [filters, setFilters] = useState({ ...(initialFilters ?? defaultConsumerFilters) });
  const hasFilters = widgets.some(widget => widget.datasetKey === 'commerce' || widget.datasetKey === 'channels');
  const availability = summarizeSampleAvailability(widgets, filters);
  const incomplete = availability.noMatch + availability.unavailable;

  function changeFilters(next: ConsumerFilters) {
    setFilters(next);
    onFiltersChange?.(next);
  }

  return <>
    {(!editing || widgets.length > 0) && <div className="dashboard-toolbar"><div className="toolbar-left"><span className="live-indicator"><span /> Static fictional sample</span><span className="toolbar-separator" /><span className="toolbar-muted"><Clock3 size={15} /> Dashboard saved {new Date(updatedAt).toLocaleDateString()} · Sample freshness unavailable</span></div></div>}
    {!editing && <details className="consumer-guidance"><summary>How to explore this dashboard</summary>
      <ul><li>Start with a visualization's title and “At a glance” insight when available.</li>
        <li>Choose “View data table” below a chart to see exact fictional values and use keyboard-accessible controls.</li>
        <li>Choose the reporting period at the top of the dashboard. Select a marketing channel when available; remove its filter to see all channels.</li>
        <li>{canEdit ? 'For advanced composition, choose Edit dashboard above. Viewing and filtering never save changes.' : 'This is a read-only view; exploring and filtering never change the saved dashboard.'}</li></ul>
    </details>}
    {hasFilters && <DashboardFiltersBar filters={filters} onChange={changeFilters} widgets={widgets} />}
    {!editing && incomplete > 0 && <section className="dashboard-availability" aria-label="Visualization availability">
      <p role="status" aria-live="polite" aria-atomic="true"><strong>Partial dashboard data:</strong> {availability.available} of {widgets.length} visualizations have usable sample records.
        {availability.noMatch > 0 && <> {availability.noMatch} have no records matching the selected filters.</>}
        {availability.unavailable > 0 && <> {availability.unavailable} are unavailable or unsupported.</>}
      </p>
      <p>Available visualizations remain usable. Unavailable cards are not counted as zero, and no dashboard-wide total is calculated.</p>
    </section>}
    <DashboardCanvas widgets={widgets} filters={filters} editing={editing} canEdit={canEdit} onStartEdit={onStartEdit} onEdit={onEdit} onAdd={onAdd} onAddSaved={onAddSaved} onDuplicate={onDuplicate} onSaveToLibrary={onSaveToLibrary} onChange={onChange}
      onChannelSelect={channel => changeFilters({ ...filters, channel: toggleChannel(filters.channel, channel) })}
      onPeriodReset={() => changeFilters({ ...filters, period: '12m' })}
      onShareInsight={onShareInsight ? widget => onShareInsight(widget, filters) : undefined} />
  </>;
}
