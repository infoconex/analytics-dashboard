import { useMemo, useRef, useState } from 'react';
import {
  fieldFilterDimensions, fieldFilterOperatorLabels, fieldFilterValueError,
  getFieldFilterCapabilities, parseFieldFilterValues, type FieldFilter, type FieldFilterOperator,
} from './fieldFilterFixtures';
import './fieldFilterBuilder.css';

interface Props {
  filters: FieldFilter[];
  onFiltersChange: (filters: FieldFilter[]) => void;
}

const noValueOperators = new Set<FieldFilterOperator>(['IsNull', 'IsNotNull']);
function formatFilter(filter: FieldFilter) {
  const dimension = fieldFilterDimensions.find(item => item.id === filter.dimension)?.label ?? filter.dimension;
  const value = noValueOperators.has(filter.operator) ? ''
    : filter.operator === 'In' ? ` ${filter.values.join(', ')}` : ` ${filter.values[0]}`;
  return `${dimension} ${fieldFilterOperatorLabels[filter.operator]}${value}`;
}

export function DashboardFieldFilterBuilder({ filters, onFiltersChange: setFilters }: Props) {
  const [dimension, setDimension] = useState(fieldFilterDimensions[0]?.id ?? '');
  const capabilities = useMemo(() => getFieldFilterCapabilities(dimension), [dimension]);
  const [operator, setOperator] = useState<FieldFilterOperator>(capabilities.operators[0] ?? 'Equal');
  const [rawValue, setRawValue] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const dimensionRef = useRef<HTMLSelectElement>(null);
  const isValueFree = noValueOperators.has(operator);
  const selectedDimension = fieldFilterDimensions.find(item => item.id === dimension);

  function changeDimension(next: string) {
    setDimension(next);
    const nextCapabilities = getFieldFilterCapabilities(next);
    const nextOperator = nextCapabilities.operators.includes(operator) ? operator : nextCapabilities.operators[0] ?? 'Equal';
    setOperator(nextOperator);
    setRawValue('');
    setError('');
  }

  function resetDraft() {
    setEditingIndex(null);
    setRawValue('');
    setOperator(capabilities.operators[0] ?? 'Equal');
    setError('');
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDimension) { setError('Choose an available business dimension.'); return; }
    if (!isValueFree && selectedDimension.type === 'boolean' && rawValue === '') { setError('Choose true or false.'); return; }
    const next: FieldFilter = { dimension, type: selectedDimension.type, operator, values: parseFieldFilterValues(rawValue, selectedDimension.type, operator) };
    const validationError = fieldFilterValueError(next);
    if (validationError) { setError(validationError); return; }
    const nextFilters = editingIndex === null
      ? [...filters, next]
      : filters.map((filter, index) => index === editingIndex ? next : filter);
    setFilters(nextFilters);
    resetDraft();
  }

  function edit(index: number) {
    const filter = filters[index];
    if (!filter) return;
    setDimension(filter.dimension);
    const nextCapabilities = getFieldFilterCapabilities(filter.dimension);
    setOperator(nextCapabilities.operators.includes(filter.operator) ? filter.operator : nextCapabilities.operators[0] ?? 'Equal');
    setRawValue(filter.operator === 'In' ? filter.values.join('\n') : filter.type === 'timestamp'
      ? String(filter.values[0]).replace(/Z$/, '') : String(filter.values[0] ?? ''));
    setEditingIndex(index);
    setError('');
    dimensionRef.current?.focus();
  }

  function remove(index: number) {
    const nextFilters = filters.filter((_, current) => current !== index);
    setFilters(nextFilters);
    if (editingIndex === index) resetDraft();
    else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1);
    dimensionRef.current?.focus();
  }

  return <section className="field-filter-builder" aria-labelledby="business-filters-heading">
    <h3 id="business-filters-heading">Business filters</h3>
    <p className="field-filter-intro">These temporary filters apply to saved query-backed cards with compatible approved fields. Each card explains its own filter scope. They never change saved definitions or access customer data.</p>
    <form className="field-filter-form" onSubmit={submit}>
      <label>Business dimension
        <select ref={dimensionRef} value={dimension} onChange={event => changeDimension(event.target.value)}>
          {fieldFilterDimensions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <label>Comparison
        <select aria-label="Filter comparison" value={operator} onChange={event => { setOperator(event.target.value as FieldFilterOperator); setError(''); }}>
          {capabilities.operators.map(item => <option key={item} value={item}>{fieldFilterOperatorLabels[item]}</option>)}
        </select>
      </label>
      {!isValueFree && <label className="field-filter-value">Value <span>({selectedDimension?.type})</span>
        {operator === 'In' && selectedDimension?.type === 'boolean'
          ? <select aria-label="Filter values" multiple value={rawValue.split(/\r?\n/).filter(Boolean)} onChange={event => { setRawValue(Array.from(event.target.selectedOptions, option => option.value).join('\n')); setError(''); }}>
              <option value="true">True</option><option value="false">False</option>
            </select>
          : operator === 'In'
            ? <textarea aria-label="Filter values" rows={3} value={rawValue} onChange={event => { setRawValue(event.target.value); setError(''); }} placeholder="One value per line" />
          : selectedDimension?.type === 'boolean'
          ? <select aria-label="Filter value" value={rawValue} onChange={event => { setRawValue(event.target.value); setError(''); }}>
              <option value="">Choose true or false</option><option value="true">True</option><option value="false">False</option>
            </select>
          : selectedDimension?.type === 'timestamp'
            ? <input aria-label="Filter value (UTC)" type="datetime-local" step="60" value={rawValue} onChange={event => { setRawValue(event.target.value); setError(''); }} />
            : <input aria-label="Filter value" type={selectedDimension?.type === 'number' ? 'number' : 'text'} step={selectedDimension?.type === 'number' ? 'any' : undefined} value={rawValue} onChange={event => { setRawValue(event.target.value); setError(''); }} />}
        {operator === 'In' && selectedDimension?.type !== 'boolean' && <small>Enter up to 100 values, one per line.</small>}
        {operator === 'In' && selectedDimension?.type === 'boolean' && <small>Choose true, false, or both values.</small>}
        {selectedDimension?.type === 'timestamp' && <small>Entered time is interpreted as UTC.</small>}
      </label>}
      <div className="field-filter-actions">
        <button className="button" type="submit">{editingIndex === null ? 'Apply filter' : 'Save filter'}</button>
        {editingIndex !== null && <button className="button button-light" type="button" onClick={resetDraft}>Cancel edit</button>}
      </div>
      {error && <p className="field-filter-error" role="alert">{error}</p>}
    </form>

    <section className="field-filter-active" aria-label="Active business filters">
      <div className="field-filter-active-heading">
        <h3>Active filters</h3>
        {filters.length > 0 && <button type="button" className="button button-light" onClick={() => { setFilters([]); resetDraft(); dimensionRef.current?.focus(); }}>Clear all</button>}
      </div>
      {filters.length === 0 ? <p>No field filters are active.</p> : <ul>
        {filters.map((filter, index) => <li key={`${filter.dimension}-${index}`}>
          <span>{formatFilter(filter)}</span>
          <button type="button" className="field-filter-edit" onClick={() => edit(index)}>Edit</button>
          <button type="button" className="field-filter-remove" aria-label={`Remove ${formatFilter(filter)}`} onClick={() => remove(index)}>Remove</button>
        </li>)}
      </ul>}
    </section>

  </section>;
}
