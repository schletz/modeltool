import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  onClose(): void;
  testId?: string;
}

/** Simple modal dialog; Escape closes it. */
export function Modal({ title, children, actions, onClose, testId }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} data-testid={testId}>
        <h2>{title}</h2>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
}
