import type { DashboardWidget } from './model';

/** Editor fields are ephemeral. Only committed widget drafts participate in dashboard Undo. */
export function widgetEditorHasChanges(
  current: DashboardWidget,
  original: DashboardWidget,
  description = '',
  originalDescription = '',
): boolean {
  return JSON.stringify(current) !== JSON.stringify(original) || description !== originalDescription;
}
