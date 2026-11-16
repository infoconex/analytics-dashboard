import { useState } from 'react';
import { Clock3 } from 'lucide-react';
import { DashboardCanvas } from './DashboardCanvas';
import { DashboardFiltersBar } from './DashboardFiltersBar';
import { defaultConsumerFilters, toggleChannel } from './consumerFilters';
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
}

// Mount with a dashboard-and-organization key to keep unsaved consumer filters
// scoped to one open dashboard, not to a link or server-persisted draft.
export function DashboardConsumer({ widgets, updatedAt, editing, canEdit, onStartEdit, onChange, onEdit, onAdd }: Props) {
  const [filters, setFilters] = useState({ ...defaultConsumerFilters });
  const hasCommerce = widgets.some(widget => widget.datasetKey === 'commerce');
  const hasChannels = widgets.some(widget => widget.datasetKey === 'channels');

  return <>
    <div className="dashboard-toolbar"><div className="toolbar-left"><span className="live-indicator"><span /> Sample dataset</span><span className="toolbar-separator" /><span className="toolbar-muted"><Clock3 size={15} /> Updated {new Date(updatedAt).toLocaleDateString()}</span></div></div>
    {(hasCommerce || hasChannels) && <DashboardFiltersBar filters={filters} onChange={setFilters} hasCommerce={hasCommerce} hasChannels={hasChannels} />}
    <DashboardCanvas widgets={widgets} filters={filters} editing={editing} canEdit={canEdit} onStartEdit={onStartEdit} onEdit={onEdit} onAdd={onAdd} onChange={onChange}
      onChannelSelect={channel => setFilters(current => ({ ...current, channel: toggleChannel(current.channel, channel) }))} />
  </>;
}
