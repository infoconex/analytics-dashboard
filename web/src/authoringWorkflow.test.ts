import { describe, expect, it } from 'vitest';
import type { DashboardWidget } from './model';
import { widgetEditorHasChanges } from './authoringWorkflow';

const widget: DashboardWidget = {
  id: '806e3063-18e9-4ddb-887a-229198c6dd04',
  title: 'Traffic sources',
  kind: 'donut',
  datasetKey: 'channels',
  metricKey: 'orders',
  dimensionKey: 'channel',
  appearance: { showLegend: true, showSliceLabels: false },
};

describe('UX-27 editor modification detection', () => {
  it('allows pristine editor and identical cloned values to close without confirmation', () => {
    expect(widgetEditorHasChanges({ ...widget }, widget)).toBe(false);
    expect(widgetEditorHasChanges({ ...widget, appearance: { ...widget.appearance } }, widget, 'description', 'description')).toBe(false);
  });
  it('detects title, type, data selection, appearance and layout edits', () => {
    expect(widgetEditorHasChanges({ ...widget, title: 'Updated' }, widget)).toBe(true);
    expect(widgetEditorHasChanges({ ...widget, kind: 'pie' }, widget)).toBe(true);
    expect(widgetEditorHasChanges({ ...widget, metricKey: 'sessions' }, widget)).toBe(true);
    expect(widgetEditorHasChanges({ ...widget, appearance: { ...widget.appearance, showLegend: false } }, widget)).toBe(true);
    expect(widgetEditorHasChanges({ ...widget, columns: 6 }, widget)).toBe(true);
  });
  it('tracks the separately saved template description and restores the clean baseline', () => {
    expect(widgetEditorHasChanges(widget, widget, 'New description', 'Original')).toBe(true);
    expect(widgetEditorHasChanges(widget, widget, 'Original', 'Original')).toBe(false);
  });
});
