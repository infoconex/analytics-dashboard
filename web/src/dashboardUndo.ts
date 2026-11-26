import type { DashboardWidget } from './model';

/**
 * In-memory history of dashboard widget snapshots only.
 * Dashboard metadata, saved templates, revisions and server state are not part of history.
 */
export interface WidgetHistory {
  past: DashboardWidget[][];
  future: DashboardWidget[][];
}

export const WIDGET_UNDO_LIMIT = 20;

export function emptyWidgetHistory(): WidgetHistory {
  return { past: [], future: [] };
}

function snapshot(widgets: DashboardWidget[]): DashboardWidget[] {
  return widgets.map(widget => ({
    ...widget,
    appearance: widget.appearance ? { ...widget.appearance } : widget.appearance,
    ...(widget.queryDefinition ? { queryDefinition: { ...widget.queryDefinition } } : {}),
  }));
}

/** Returns null for no-ops; a new draft operation invalidates the redo branch. */
export function captureWidgetChange(
  history: WidgetHistory, before: DashboardWidget[], after: DashboardWidget[],
): WidgetHistory | null {
  if (JSON.stringify(before) === JSON.stringify(after)) return null;
  return { past: [...history.past, snapshot(before)].slice(-WIDGET_UNDO_LIMIT), future: [] };
}

export function undoWidgetChange(
  history: WidgetHistory, current: DashboardWidget[],
): { widgets: DashboardWidget[]; history: WidgetHistory } | null {
  const previous = history.past.at(-1);
  if (!previous) return null;
  return {
    widgets: snapshot(previous),
    history: {
      past: history.past.slice(0, -1),
      future: [snapshot(current), ...history.future].slice(0, WIDGET_UNDO_LIMIT),
    },
  };
}

export function redoWidgetChange(
  history: WidgetHistory, current: DashboardWidget[],
): { widgets: DashboardWidget[]; history: WidgetHistory } | null {
  const next = history.future[0];
  if (!next) return null;
  return {
    widgets: snapshot(next),
    history: {
      past: [...history.past, snapshot(current)].slice(-WIDGET_UNDO_LIMIT),
      future: history.future.slice(1),
    },
  };
}
