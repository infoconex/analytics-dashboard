import { describe, expect, it } from 'vitest';
import { defaultCalendarSelection, resolveReportingRange, type CalendarSelection, type Preset } from './reportingCalendar';
import { evaluateCalendarSamples } from './reportingCalendarSamples';

const now = new Date('2026-11-23T20:15:30.123Z');
const resolve = (preset: Preset, changes: Partial<CalendarSelection> = {}, clock = now) =>
  resolveReportingRange({ ...defaultCalendarSelection, preset, ...changes }, clock);

describe('reporting calendar', () => {
  it.each([
    ['day', '2026-11-22T20:15:30.123Z'], ['week', '2026-11-16T20:15:30.123Z'],
    ['month', '2026-10-23T20:15:30.123Z'], ['quarter', '2026-08-23T20:15:30.123Z'],
    ['year', '2025-11-23T20:15:30.123Z'], ['today', '2026-11-23T00:00:00.000Z'],
    ['thisWeek', '2026-11-23T00:00:00.000Z'], ['thisMonth', '2026-11-01T00:00:00.000Z'],
    ['thisYear', '2026-01-01T00:00:00.000Z'],
  ] as const)('resolves %s to the single clock snapshot', (preset, start) => {
    expect(resolve(preset)).toEqual({ start, end: now.toISOString() });
  });
  it('distinguishes complete calendar periods and all time', () => {
    expect(resolve('yesterday')).toEqual({ start: '2026-11-22T00:00:00.000Z', end: '2026-11-23T00:00:00.000Z' });
    expect(resolve('lastYear')).toEqual({ start: '2025-01-01T00:00:00.000Z', end: '2026-01-01T00:00:00.000Z' });
    expect(resolve('all')).toBeNull();
    expect(resolve('thisWeek', { weekStart: 0 })?.start).toBe('2026-11-22T00:00:00.000Z');
  });
  it('clamps rolling months to valid local dates, including leap years', () => {
    expect(resolve('month', {}, new Date('2024-03-31T08:00:00Z'))?.start).toBe('2024-02-29T08:00:00.000Z');
    expect(resolve('year', {}, new Date('2024-02-29T08:00:00Z'))?.start).toBe('2023-02-28T08:00:00.000Z');
  });
  it('calendar days follow DST while rolling days remain elapsed time', () => {
    const zone = 'America/Los_Angeles';
    const spring = new Date('2026-03-09T12:00:00Z');
    const autumn = new Date('2026-11-02T12:00:00Z');
    expect(resolve('yesterday', { zone }, spring)).toEqual({ start: '2026-03-08T08:00:00.000Z', end: '2026-03-09T07:00:00.000Z' });
    expect(resolve('yesterday', { zone }, autumn)).toEqual({ start: '2026-11-01T07:00:00.000Z', end: '2026-11-02T08:00:00.000Z' });
    expect(resolve('day', { zone }, spring)?.start).toBe('2026-03-08T12:00:00.000Z');
    expect(resolve('today', { zone: 'Asia/Kolkata' })?.start).toBe('2026-11-23T18:30:00.000Z');
  });
  it('rejects nonexistent, ambiguous, malformed, reversed and empty custom ranges', () => {
    const zone = 'America/Los_Angeles';
    expect(() => resolve('custom', { zone, start: '2026-03-08T02:30', end: '2026-03-08T04:00' })).toThrow(/does not exist/);
    expect(() => resolve('custom', { zone, start: '2026-11-01T01:30', end: '2026-11-01T04:00' })).toThrow(/occurs twice/);
    for (const start of ['2026-02-30T00:00', '2026-11-18T00:00', '2026-11-17T00:00', '']) {
      expect(() => resolve('custom', { start, end: '2026-11-17T00:00' })).toThrow();
    }
    expect(() => resolve('today', { zone: 'invalid-zone' })).toThrow();
    expect(() => resolve('thisWeek', { weekStart: 7 })).toThrow();
  });
  it('applies one half-open range before aggregation to independent mapped datasets', () => {
    const range = resolve('custom', { start: '2026-11-16T00:00', end: '2026-11-17T00:00' });
    expect(evaluateCalendarSamples(range)).toEqual([
      { name: 'Sales revenue', applied: true, compatible: true, count: 2, total: 20 },
      { name: 'Support requests', applied: true, compatible: true, count: 1, total: 1 },
      { name: 'Undated inventory', applied: false, compatible: false, count: 1, total: 42 },
    ]);
    expect(evaluateCalendarSamples(null).map(x => x.total)).toEqual([345, 5, 42]);
    const empty = resolve('custom', { start: '2026-11-18T00:00', end: '2026-11-19T00:00' });
    expect(evaluateCalendarSamples(empty).map(x => x.total)).toEqual([null, null, 42]);
  });
});
