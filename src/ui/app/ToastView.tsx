import { useEffect } from 'react';
import { useUiStore } from '../store/uiStore';
import { useT } from '../i18n/language';

/** Short notification at the bottom of the screen; disappears after a few seconds. */
export function ToastView() {
  const t = useT();
  const toast = useUiStore((s) => s.toast);
  const dismiss = useUiStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismiss, toast.kind === 'error' ? 6000 : 2500);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  if (!toast) return null;
  return (
    <div className={`toast ${toast.kind}`} role="status" data-testid="toast" onClick={dismiss}>
      {t(toast.message, toast.params)}
    </div>
  );
}
