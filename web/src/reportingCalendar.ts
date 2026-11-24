export const rollingPresets = [
  ['day', 'Last 1 day'], ['week', 'Last 1 week'], ['month', 'Last 1 month'],
  ['quarter', 'Last 3 months'], ['year', 'Last 12 months'],
] as const;
export const calendarPresets = [
  ['today', 'Today'], ['yesterday', 'Yesterday'], ['thisWeek', 'This week'],
  ['thisMonth', 'This month'], ['thisYear', 'This year'], ['lastYear', 'Last year'],
] as const;
export type Preset = typeof rollingPresets[number][0] | typeof calendarPresets[number][0] | 'custom' | 'all';
export interface CalendarSelection {
  preset: Preset;
  zone: string;
  weekStart: number;
  start: string;
  end: string;
}
export interface UtcRange { start: string; end: string }
type Wall = { year: number; month: number; day: number; hour: number; minute: number; second: number; millisecond: number };
const dayMs = 86_400_000;

function epoch(w: Wall): number {
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second, w.millisecond);
}
function utcWall(ms: number): Wall {
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
    hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(), millisecond: d.getUTCMilliseconds() };
}
function formatter(zone: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, calendar: 'iso8601', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    second: '2-digit', hourCycle: 'h23' });
}
function wall(ms: number, fmt: Intl.DateTimeFormat): Wall {
  const parts = Object.fromEntries(fmt.formatToParts(ms).map(p => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second),
    millisecond: ((ms % 1000) + 1000) % 1000 };
}
function midnight(w: Wall): Wall { return { ...w, hour: 0, minute: 0, second: 0, millisecond: 0 }; }
function addDays(w: Wall, days: number): Wall { return utcWall(epoch(w) + days * dayMs); }
function subtractMonths(w: Wall, months: number): Wall {
  const first = new Date(Date.UTC(w.year, w.month - 1 - months, 1));
  const year = first.getUTCFullYear(), month = first.getUTCMonth() + 1;
  const max = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { ...w, year, month, day: Math.min(w.day, max) };
}
function parseLocal(raw: string): Wall {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw);
  if (!match) throw new Error('Enter both dates and times to the minute.');
  const w: Wall = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
    hour: Number(match[4]), minute: Number(match[5]), second: 0, millisecond: 0 };
  if (w.year < 1970 || w.year > 9998 || epoch(utcWall(epoch(w))) !== epoch(w)
      || Object.keys(w).some(k => w[k as keyof Wall] !== utcWall(epoch(w))[k as keyof Wall]))
    throw new Error('Enter a valid date between 1970 and 9998.');
  return w;
}
// Discover possible offsets around a wall time and verify each candidate by
// round trip. Never silently normalize a nonexistent/ambiguous custom time.
function instant(w: Wall, fmt: Intl.DateTimeFormat, custom: boolean): number {
  const nominal = epoch(w);
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = nominal + hours * 3_600_000;
    offsets.add(epoch(wall(sample, fmt)) - sample);
  }
  const candidates = [...offsets].map(offset => nominal - offset)
    .filter(ms => epoch(wall(ms, fmt)) === nominal).sort((a, b) => a - b);
  if (!candidates.length) throw new Error('This local time does not exist in the selected timezone. Choose another time.');
  if (custom && candidates.length > 1) throw new Error('This local time occurs twice in the selected timezone. Choose another time or UTC.');
  return candidates[0]!;
}

export function resolveReportingRange(selection: CalendarSelection, now: Date): UtcRange | null {
  const fmt = formatter(selection.zone);
  const endNow = now.getTime();
  if (!Number.isFinite(endNow) || !Number.isInteger(selection.weekStart) || selection.weekStart < 0 || selection.weekStart > 6)
    throw new Error('Invalid reporting clock or week start.');
  if (selection.preset === 'all') return null;
  const current = wall(endNow, fmt), today = midnight(current);
  let start: number, end = endNow;
  switch (selection.preset) {
    case 'custom':
      start = instant(parseLocal(selection.start), fmt, true);
      end = instant(parseLocal(selection.end), fmt, true);
      break;
    case 'day': start = endNow - dayMs; break;
    case 'week': start = endNow - 7 * dayMs; break;
    case 'month': case 'quarter': case 'year':
      start = instant(subtractMonths(current, selection.preset === 'month' ? 1 : selection.preset === 'quarter' ? 3 : 12), fmt, false);
      break;
    case 'today': start = instant(today, fmt, false); break;
    case 'yesterday':
      start = instant(addDays(today, -1), fmt, false); end = instant(today, fmt, false); break;
    case 'thisWeek': {
      const weekday = new Date(epoch(today)).getUTCDay();
      start = instant(addDays(today, -((weekday - selection.weekStart + 7) % 7)), fmt, false); break;
    }
    case 'thisMonth': start = instant({ ...today, day: 1 }, fmt, false); break;
    case 'thisYear': start = instant({ ...today, month: 1, day: 1 }, fmt, false); break;
    case 'lastYear':
      start = instant({ ...today, year: today.year - 1, month: 1, day: 1 }, fmt, false);
      end = instant({ ...today, month: 1, day: 1 }, fmt, false); break;
    default: throw new Error('Unsupported reporting period.');
  }
  if (!(start < end)) throw new Error('Start must be before end. Choose a non-empty reporting period.');
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

export const defaultCalendarSelection: CalendarSelection = { preset: 'all', zone: 'UTC', weekStart: 1, start: '', end: '' };
export function presetLabel(preset: Preset): string {
  return [...rollingPresets, ...calendarPresets].find(p => p[0] === preset)?.[1] ?? (preset === 'all' ? 'All time' : 'Custom range');
}
