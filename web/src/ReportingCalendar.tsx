import { useRef, useState } from 'react';
import { calendarPresets, defaultCalendarSelection, presetLabel, resolveReportingRange, rollingPresets,
  type CalendarSelection, type Preset, type UtcRange } from './reportingCalendar';
import { evaluateCalendarSamples } from './reportingCalendarSamples';
import './reportingCalendar.css';

const zones = [...new Set(['UTC', Intl.DateTimeFormat().resolvedOptions().timeZone, 'America/Los_Angeles',
  'America/New_York', 'Europe/London', 'Europe/Paris', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney'])];
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function ReportingCalendar() {
  const [draft, setDraft] = useState<CalendarSelection>(defaultCalendarSelection);
  const [applied, setApplied] = useState<CalendarSelection>(defaultCalendarSelection);
  const [range, setRange] = useState<UtcRange | null>(null);
  const [error, setError] = useState('');
  const selector = useRef<HTMLSelectElement>(null);
  const results = evaluateCalendarSamples(range);
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);
  function change(patch: Partial<CalendarSelection>) { setDraft(previous => ({ ...previous, ...patch })); setError(''); }
  function apply() {
    try {
      const next = resolveReportingRange(draft, new Date());
      setRange(next); setApplied({ ...draft }); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Invalid reporting period.'); }
  }
  function clear() {
    const next = { ...applied, preset: 'all' as const, start: '', end: '' };
    setDraft(next); setApplied(next); setRange(null); setError(''); selector.current?.focus();
  }
  return <details className="reporting-calendar">
    <summary>Experimental reporting period · {presetLabel(applied.preset)}</summary>
    <p>Calendar filtering evaluation only. Fixed fictional Sales and Support event records (November 2025 and 2026). Existing dashboard visualizations remain unchanged; their original samples have no approved calendar timestamps.</p>
    <form onSubmit={event => { event.preventDefault(); apply(); }}>
      <div className="reporting-calendar-fields">
        <label>Reporting period<select ref={selector} value={draft.preset} onChange={event => change({ preset: event.target.value as Preset })}>
          <option value="all">All time</option>
          <optgroup label="Rolling periods">{rollingPresets.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</optgroup>
          <optgroup label="Calendar periods">{calendarPresets.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</optgroup>
          <option value="custom">Custom date/time range</option>
        </select></label>
        <label>Timezone<select value={draft.zone} onChange={event => change({ zone: event.target.value })}>
          {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
        </select></label>
        <label>Week starts on<select value={draft.weekStart} onChange={event => change({ weekStart: Number(event.target.value) })}>
          {weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}
        </select></label>
        {draft.preset === 'custom' && <>
          <label>Start date and time<input type="datetime-local" required min="1970-01-01T00:00" max="9998-12-31T23:59" value={draft.start} onChange={event => change({ start: event.target.value })} /></label>
          <label>End date and time (exclusive)<input type="datetime-local" required min="1970-01-01T00:00" max="9998-12-31T23:59" value={draft.end} onChange={event => change({ end: event.target.value })} /></label>
        </>}
      </div>
      {error && <p role="alert">{error} The previous applied period remains unchanged.</p>}
      <div className="reporting-calendar-actions">
        <button className="button" type="submit">Apply reporting period</button>
        <button className="button" type="button" disabled={!dirty && !error} onClick={() => { setDraft(applied); setError(''); selector.current?.focus(); }}>Cancel period changes</button>
        <button className="button" type="button" onClick={clear}>Clear reporting period</button>
      </div>
    </form>
    <div role="status" aria-label="Calendar filter scope" className="reporting-calendar-status">
      <strong>{presetLabel(applied.preset)} · {applied.zone}</strong>
      <p>{range ? 'UTC interval: ' + range.start + ' to ' + range.end + ' (exclusive). Applies to 2 experimental visualizations; undated inventory unchanged.' : 'No calendar restriction. All experimental records.'}</p>
    </div>
    <div className="reporting-calendar-results">
      {results.map(result => <section key={result.name} aria-label={result.name}>
        <h3>{result.name}</h3>
        <strong>{result.total === null ? 'No matching records' : result.name === 'Sales revenue' ? '$' + result.total : result.total}</strong>
        <p>{result.count} fictional records · {result.applied ? 'Calendar filter applied' : result.compatible ? 'All time' : 'No approved reporting time'}</p>
      </section>)}
    </div>
  </details>;
}
