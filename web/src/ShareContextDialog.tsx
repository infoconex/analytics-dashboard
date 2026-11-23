import { useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import type { ConsumerFilters } from './consumerFilters';
import type { Dashboard, DashboardWidget } from './model';
import { dashboardHandoffLink, dashboardHandoffNote, insightHandoffNote, viewingScope } from './insightHandoff';
import { ModalDialog } from './ui/ModalDialog';

interface Props {
  dashboard: Dashboard;
  organizationName: string;
  filters: ConsumerFilters;
  widget?: DashboardWidget;
  onDismiss: () => void;
}

export function ShareContextDialog({ dashboard, organizationName, filters, widget, onDismiss }: Props) {
  const link = dashboardHandoffLink(window.location.origin, window.location.pathname, dashboard);
  const note = widget
    ? insightHandoffNote(dashboard, organizationName, widget, filters, link)
    : dashboardHandoffNote(dashboard, organizationName, filters, link);
  const [status, setStatus] = useState('');
  const linkField = useRef<HTMLInputElement>(null);
  const noteField = useRef<HTMLTextAreaElement>(null);

  async function copy(value: string, field: HTMLInputElement | HTMLTextAreaElement | null, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(`${label} copied. Recipients still need organization access.`);
    } catch {
      field?.focus();
      field?.select();
      setStatus('Clipboard unavailable. The text is selected; copy it manually.');
    }
  }

  return <ModalDialog title={widget ? 'Share insight context' : 'Share dashboard'} eyebrow="SAMPLE DATA · HANDOFF"
    description="Share an authorized destination and, if useful, a separate snapshot of what you are seeing."
    onDismiss={onDismiss} initialFocus=".share-link-field" className="share-context-modal">
    <div className="handoff-context">
      <div><strong>Organization</strong><span>{organizationName}</span></div>
      <div><strong>Saved dashboard</strong><span>{dashboard.name}</span></div>
      <div><strong>Revision in this view</strong><span>Saved revision {dashboard.revision}</span></div>
      {widget && <div><strong>Selected visualization</strong><span>{widget.title}</span></div>}
      <div><strong>Data source</strong><span>Deterministic fictional sample · No live data or refresh timestamp</span></div>
    </div>
    <p className="handoff-explainer">This link opens the <strong>latest saved revision</strong> available to an authorized recipient when they open or reload it. It does not pin the revision shown here, publish unsaved edits, carry your temporary filters or expanded interpretation, or grant organization access. The link opens with default filters for people authorized to view this organization.</p>
    <label className="handoff-field">Saved dashboard link
      <input className="share-link-field" ref={linkField} readOnly value={link} onFocus={event => event.currentTarget.select()} />
    </label>
    <button type="button" className="button button-primary handoff-copy" onClick={() => void copy(link, linkField.current, 'Dashboard link')}>
      <Copy size={16} aria-hidden="true" /> Copy dashboard link
    </button>
    <details className="handoff-disclosure">
      <summary>{widget ? 'Include this insight’s context and exact values' : 'Include your current viewing context'}</summary>
      <p>These selections apply independently and are <strong>not saved in the link</strong>:</p>
      <ul>{viewingScope(filters, dashboard.widgets).map(item => <li key={item}>{item}</li>)}</ul>
      <p>A context note records these fictional values at the moment of copying. It is plain text, not a persistent report or permission grant.</p>
      {note ? <><label className="handoff-field">Context note (selectable text)
        <textarea ref={noteField} readOnly value={note} rows={6} onFocus={event => event.currentTarget.select()} />
      </label>
        <button type="button" className="button button-light handoff-copy" onClick={() => void copy(note, noteField.current, 'Context note')}>
          <Copy size={16} aria-hidden="true" /> Copy context note
        </button></> : <p role="status">An exact insight note is unavailable for this visualization. No value was inferred.</p>}
    </details>
    <div role="status" className="handoff-status" aria-live="polite">{status}</div>
    <div className="modal-actions"><button type="button" className="button button-light" onClick={onDismiss}>Done</button></div>
  </ModalDialog>;
}
