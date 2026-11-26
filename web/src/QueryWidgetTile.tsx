import { BookmarkPlus, CopyPlus, Pencil, Trash2 } from 'lucide-react';
import type { DashboardWidget } from './model';
import type { ConsumerFilters } from './consumerFilters';
import { fieldFilterDimensions, getQueryPreviewAuthoringOptions } from './fieldFilterFixtures';
import { evaluateQueryWidget, type QueryContext } from './queryVisualization';
import './queryVisualization.css';

interface Props {
  widget: DashboardWidget;
  preview?: boolean;
  position?: number;
  total?: number;
  editing?: boolean;
  filters?: ConsumerFilters;
  queryContext?: QueryContext;
  onEdit?: (widget: DashboardWidget) => void;
  onRepair?: (widget: DashboardWidget) => void;
  onRemove?: (id: string) => void;
  onDuplicate?: (widget: DashboardWidget) => void;
  onSaveToLibrary?: (widget: DashboardWidget) => void;
  onReturnToIndex?: () => void;
}

const reasons = {
  NoApprovedMapping: 'no approved business dimension mapping',
  FieldNotFilterable: 'the mapped field cannot be filtered',
  IncompatibleType: 'incompatible value type',
  UnsupportedOperator: 'the fictional provider does not support this comparison',
};

export function QueryWidgetTile({ widget, preview, position, total, editing, filters, queryContext, onEdit, onRepair, onRemove, onDuplicate, onSaveToLibrary, onReturnToIndex }: Props) {
  const headingId = `widget-heading-${preview ? 'preview-' : ''}${widget.id}`;
  const result = evaluateQueryWidget(widget, queryContext);
  const state = !result ? 'unavailable' : result.count ? 'available' : 'no-match';
  const options = result ? getQueryPreviewAuthoringOptions(result.query.dataset) : null;
  const groupLabel = options?.groups.find(group => group.id === result?.query.groupByDimension)?.label ?? 'Group';
  const measure = result?.query.aggregate === 'count' ? 'Count records' : `Sum ${options?.sumMeasure?.label ?? 'measure'}`;
  const max = Math.max(1, ...(result?.groups.map(group => group.value) ?? []));
  const appliedCount = result?.applied.length ?? 0;
  return <article className="widget-tile widget-bar query-widget" data-availability={state} aria-labelledby={headingId}>
    <div className="widget-heading">
      <div><h2 className="widget-title" id={headingId} tabIndex={-1}>{widget.title}</h2>
        <div className="widget-subtitle">Fictional raw records{result && ` · ${result.title} · ${result.provider}`}</div></div>
      {editing ? <div className="widget-actions">
        <button type="button" aria-label={result ? `Edit ${widget.title}` : `Review configuration for ${widget.title}`} className="icon-button" onClick={() => onEdit?.(widget)}><Pencil size={15} /></button>
        <button type="button" aria-label={`Duplicate ${widget.title}`} className="icon-button" onClick={() => onDuplicate?.(widget)}><CopyPlus size={15} /></button>
        <button type="button" aria-label={`Save ${widget.title} to library`} className="icon-button" onClick={() => onSaveToLibrary?.(widget)}><BookmarkPlus size={15} /></button>
        <button type="button" aria-label={`Remove ${widget.title}`} className="icon-button danger-hover" onClick={() => onRemove?.(widget.id)}><Trash2 size={15} /></button>
      </div> : <div className="widget-heading-shortcuts">
        {position && total && <span className="widget-position"><span aria-hidden="true">{position} / {total}</span><span className="sr-only">Visualization {position} of {total}</span></span>}
        {onReturnToIndex && <button type="button" className="widget-index-shortcut" onClick={onReturnToIndex} aria-label={`Jump to visualization index from ${widget.title}`}>Index</button>}
      </div>}
    </div>
    {!result ? <>
      <p className="widget-empty"><strong>Insight unavailable.</strong> Unsupported saved fictional query definition. No value has been inferred.</p>
      {!editing && onRepair && <button type="button" className="widget-recovery" onClick={() => onRepair(widget)}>Review configuration for {widget.title}</button>}
    </> : <>
      <p className="query-widget-shape">{measure} by {groupLabel}</p>
      <p role="status" aria-live="polite">{result.count} fictional {result.count === 1 ? 'record' : 'records'}{!result.count && ' · No matching records.'}</p>
      {result.groups.length > 0 && <table className="query-widget-table">
        <thead><tr><th scope="col">{groupLabel}</th><th scope="col">{measure}</th></tr></thead>
        <tbody>{result.groups.map(group => <tr key={group.label}><th scope="row">{group.label}</th><td>
          {group.value.toLocaleString()}<span className="query-widget-bar-track" aria-hidden="true"><span style={{ width: `${group.value / max * 100}%` }} /></span>
        </td></tr>)}</tbody>
      </table>}
      <div className="query-widget-scope" aria-label={`Filter scope for ${widget.title}`}>
        <p>{result.unapplied.length ? appliedCount ? `Partially filtered: ${appliedCount} applied; ${result.unapplied.length} not applied.` : 'Unchanged: no typed filters could be applied.' : appliedCount ? `Applied ${appliedCount} typed ${appliedCount === 1 ? 'filter' : 'filters'} before aggregation.` : 'No typed filters selected.'}</p>
        {result.unapplied.map((item, index) => <p key={`${item.dimension}-${index}`}>{fieldFilterDimensions.find(dimension => dimension.id === item.dimension)?.label ?? item.dimension}: {reasons[item.reason]}.</p>)}
        <p>{result.calendar === 'Applied' ? 'Reporting period applied before aggregation.' : result.calendar === 'No approved reporting time' ? 'Reporting period not applied: no approved reporting-time mapping.' : 'All time was selected.'}</p>
        {filters && (filters.period !== '12m' || filters.channel) && <p>Legacy sample month and marketing channel selections do not apply to raw records.</p>}
      </div>
    </>}
    {onReturnToIndex && <div className="widget-return"><button type="button" onClick={onReturnToIndex} aria-label={`Back to visualization list from ${widget.title}`}>Back to visualization list</button></div>}
  </article>;
}
