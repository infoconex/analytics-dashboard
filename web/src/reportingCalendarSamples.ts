import type { UtcRange } from './reportingCalendar';

// Fixed fictional event records, never inferred from the existing aggregate samples.
// Explicit metadata mirrors the EXP-01 reporting_time business-dimension mapping.
type Sample = { name: string; reportingTime: string | null; rows: ReadonlyArray<Readonly<Record<string, string | number>>> };
const samples: readonly Sample[] = [
  { name: 'Sales revenue', reportingTime: 'OrderDate', rows: [
    { OrderDate: '2025-11-20T12:00:00.000Z', amount: 80 },
    { OrderDate: '2026-11-15T23:59:59.999Z', amount: 100 },
    { OrderDate: '2026-11-16T00:00:00.000Z', amount: 12 },
    { OrderDate: '2026-11-16T23:59:59.999Z', amount: 8 },
    { OrderDate: '2026-11-17T00:00:00.000Z', amount: 100 },
    { OrderDate: '2026-11-23T12:00:00.000Z', amount: 45 },
  ] },
  { name: 'Support requests', reportingTime: 'OpenedAt', rows: [
    { OpenedAt: '2025-11-20T12:00:00.000Z', amount: 1 },
    { OpenedAt: '2026-11-15T23:59:59.999Z', amount: 1 },
    { OpenedAt: '2026-11-16T00:00:00.000Z', amount: 1 },
    { OpenedAt: '2026-11-17T00:00:00.000Z', amount: 1 },
    { OpenedAt: '2026-11-23T12:00:00.000Z', amount: 1 },
  ] },
  { name: 'Undated inventory', reportingTime: null, rows: [{ amount: 42 }] },
];
export function evaluateCalendarSamples(range: UtcRange | null) {
  return samples.map(sample => {
    const field = sample.reportingTime;
    const applied = range !== null && field !== null;
    const rows = applied ? sample.rows.filter(row => {
      const timestamp = Date.parse(String(row[field!]));
      return Number.isFinite(timestamp) && timestamp >= Date.parse(range.start) && timestamp < Date.parse(range.end);
    }) : sample.rows;
    return { name: sample.name, applied, compatible: field !== null, count: rows.length,
      total: rows.length === 0 ? null : rows.reduce((sum, row) => sum + Number(row.amount), 0) };
  });
}
