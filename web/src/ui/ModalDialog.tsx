import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  eyebrow: string;
  description: string;
  onDismiss: () => void;
  children: ReactNode;
  initialFocus: string;
  busy?: boolean;
  className?: string;
}

/** Native modal behavior keeps background content inert and keyboard focus contained. */
export function ModalDialog({ title, eyebrow, description, onDismiss, children, initialFocus, busy = false, className = '' }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>(initialFocus)?.focus();
    return () => {
      dialog.close();
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [initialFocus]);

  return <dialog
    ref={dialogRef}
    className={`modal ${className}`.trim()}
    aria-labelledby={titleId}
    aria-describedby={descriptionId}
    onCancel={event => {
      event.preventDefault();
      if (!busy) onDismiss();
    }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      // Responsive layouts may hide redundant actions. Never include display:none
      // descendants in the first/last focus trap (notably mobile library footer).
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex="-1"])',
      )).filter(node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden');
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }}
  >
    <div className="modal-heading">
      <div><span className="eyebrow">{eyebrow}</span><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div>
      <button type="button" className="icon-button" aria-label="Close" disabled={busy} onClick={onDismiss}><X size={20} /></button>
    </div>
    {children}
  </dialog>;
}
