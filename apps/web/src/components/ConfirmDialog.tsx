import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, busy, destructive, onConfirm, onCancel }: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [busy, onCancel]);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={() => !busy && onCancel()}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" type="button" aria-label="Close dialog" onClick={onCancel} disabled={busy}><X size={17} /></button>
        <span className={`dialog-icon ${destructive ? 'destructive' : ''}`}><AlertTriangle size={22} /></span>
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="dialog-actions">
          <button className="dialog-secondary" type="button" onClick={onCancel} disabled={busy}>Keep it</button>
          <button ref={confirmRef} className={`dialog-confirm ${destructive ? 'destructive' : ''}`} type="button" onClick={onConfirm} disabled={busy}>
            {busy && <span className="spinner" />}{busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
