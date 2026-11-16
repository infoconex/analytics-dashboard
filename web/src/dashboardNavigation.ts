// Resolve a native selector's value against the current canvas, not a stale
// selection left over from a deleted or replaced widget.
export function resolveNavigationSelection(widgets: ReadonlyArray<{ id: string }>, selectedId: string): string | null {
  return selectedId && widgets.some(widget => widget.id === selectedId) ? selectedId : null;
}
