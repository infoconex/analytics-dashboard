import { useCallback, useEffect, useState } from 'react';
import { Clock3, Database, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { dataSourceApi } from './api';
import { ApiError, type DataSourceDefinition, type DataSourceProvider } from './model';
import { Button } from './ui/Button';
import { ModalDialog } from './ui/ModalDialog';

const providers: { id: DataSourceProvider; name: string; initials: string; category: string; tone: string }[] = [
  { id: 'sqlServer', name: 'Microsoft SQL Server', initials: 'SQL', category: 'Relational database', tone: 'source-red' },
  { id: 'mySql', name: 'MySQL', initials: 'my', category: 'Relational database', tone: 'source-orange' },
  { id: 'postgreSql', name: 'PostgreSQL', initials: 'Pg', category: 'Relational database', tone: 'source-blue' },
  { id: 'sqlite', name: 'SQLite', initials: 'Sq', category: 'Embedded database', tone: 'source-cyan' },
  { id: 'elasticsearch', name: 'Elasticsearch', initials: 'E', category: 'Search & analytics', tone: 'source-yellow' },
];

type EditState = { definition?: DataSourceDefinition; name: string; provider: DataSourceProvider };

export function DataSourcesPage({ organizationId, canEdit, onNotice }: {
  organizationId: string;
  canEdit: boolean;
  onNotice: (message: string) => void;
}) {
  const [definitions, setDefinitions] = useState<DataSourceDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState<EditState | null>(null);

  const reload = useCallback(async () => {
    const items = await dataSourceApi.list(organizationId);
    setDefinitions(items);
  }, [organizationId]);

  useEffect(() => {
    let active = true;
    dataSourceApi.list(organizationId).then(items => {
      if (active) { setDefinitions(items); setError(''); }
    }).catch(exception => {
      if (active) setError(exception instanceof Error ? exception.message : 'Unable to load data sources.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organizationId]);

  async function save() {
    if (!edit || !edit.name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      if (edit.definition) {
        await dataSourceApi.update(organizationId, edit.definition, edit.name);
        onNotice('Data-source definition renamed');
      } else {
        await dataSourceApi.create(organizationId, { name: edit.name, provider: edit.provider });
        onNotice('Data-source definition registered');
      }
      await reload();
      setEdit(null);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Unable to save the data source.');
      // Refresh revision metadata after a possible concurrent edit.
      try { await reload(); } catch { /* Keep the original error visible. */ }
      if (exception instanceof ApiError && exception.status === 409) setEdit(null);
    } finally {
      setBusy(false);
    }
  }

  async function remove(definition: DataSourceDefinition) {
    if (busy || !window.confirm(`Remove registration "${definition.name}"? No database connection will be affected.`)) return;
    setBusy(true);
    setError('');
    try {
      await dataSourceApi.remove(organizationId, definition);
      await reload();
      onNotice('Data-source definition removed');
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Unable to remove the data source.');
      try { await reload(); } catch { /* Keep the original error visible. */ }
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="page-heading">
      <div><div className="eyebrow">DATA INTEGRATIONS</div><h1>Data sources</h1>
        <p>Register provider and display-name metadata for your organization.</p></div>
      {canEdit && <Button onClick={() => setEdit({ name: '', provider: 'sqlServer' })}>
        <Plus size={17} /> Register data source
      </Button>}
    </div>
    <div className="info-banner" role="note"><ShieldCheck size={20} /><div>
      <strong>Registration only — no live connections</strong>
      <p>Definitions contain only a provider and a name. Credentials, connection strings, network endpoints, connection tests, and query execution are unavailable. All dashboard charts still use demonstration data.</p>
    </div></div>
    {error && !edit && <div className="error-banner" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}
    <div className="source-heading"><h2>Registered definitions</h2><span>{definitions.length} registered</span></div>
    {loading ? <div className="loading-state" role="status" aria-live="polite">Loading data-source definitions…</div>
      : definitions.length === 0 ? <div className="source-empty"><Database size={27} />
          <strong>No data sources registered</strong>
          <p>{canEdit ? 'Start by registering a provider and display name.' : 'An organization editor can register a data-source definition.'}</p>
        </div>
      : <div className="registered-sources">
          {definitions.map(item => {
            const provider = providers.find(candidate => candidate.id === item.provider);
            return <article className="registered-source" key={item.id}>
              <span className={`source-avatar ${provider?.tone ?? 'source-blue'}`}>{provider?.initials ?? 'DB'}</span>
              <div className="registered-source-details"><h3>{item.name}</h3>
                <p>{provider?.name ?? 'Unsupported provider'} · Revision {item.revision}</p>
                <small>Registered by {item.createdBy} · Updated {new Date(item.updatedAt).toLocaleDateString()}</small></div>
              <span className="source-unconnected"><Clock3 size={14} /> Not connected</span>
              {canEdit && <div className="registered-source-actions">
                <button className="icon-button" aria-label={`Rename ${item.name}`} title="Rename definition" disabled={busy}
                  onClick={() => setEdit({ definition: item, name: item.name, provider: item.provider })}><Pencil size={16} /></button>
                <button className="icon-button danger-hover" aria-label={`Remove ${item.name}`} title="Remove definition" disabled={busy}
                  onClick={() => void remove(item)}><Trash2 size={16} /></button>
              </div>}
            </article>;
          })}
        </div>}
    <div className="source-heading source-catalog-heading"><h2>Supported registration providers</h2><span>5 providers · connection adapters planned</span></div>
    <div className="source-grid">{providers.map(item => <article className="source-card" key={item.id}>
      <div className={`source-avatar ${item.tone}`}>{item.initials}</div>
      <h3>{item.name}</h3><p>{item.category}</p>
      <span><Clock3 size={14} /> Metadata only</span>
    </article>)}</div>

    {edit && <ModalDialog title={edit.definition ? 'Rename data source' : 'Register data source'}
      eyebrow="ORGANIZATION METADATA" description="Only provider and display name are recorded. This does not establish a connection."
      initialFocus="input" busy={busy} onDismiss={() => setEdit(null)}>
        {error && <p className="error-banner" role="alert">{error}</p>}
        <label className="form-label">Display name
          <input maxLength={100} value={edit.name} onChange={event => setEdit({ ...edit, name: event.target.value })}
            placeholder="e.g. Customer reporting" /></label>
        <label className="form-label">Provider
          <select value={edit.provider} disabled={Boolean(edit.definition)} onChange={event =>
            setEdit({ ...edit, provider: event.target.value as DataSourceProvider })}>
            {providers.map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
          </select></label>
        <p className="source-form-note">Do not enter credentials, connection details, or network addresses in the display name.</p>
        <div className="modal-actions"><Button variant="light" disabled={busy} onClick={() => setEdit(null)}>Cancel</Button>
          <Button disabled={busy || !edit.name.trim()} onClick={() => void save()}>
            {busy ? 'Saving…' : edit.definition ? 'Save name' : 'Register definition'}
          </Button></div>
      </ModalDialog>}
  </>;
}
