import { useDocumentStore } from '../store/documentStore';
import { useT } from '../i18n/language';
import type { AutosaveEntry } from '../services/autosave';
import { Modal } from './Modal';

interface RestoreDialogProps {
  entry: AutosaveEntry;
  onDone(): void;
}

/** Offers to restore the autosaved state at startup (spec 9.3). */
export function RestoreDialog({ entry, onDone }: RestoreDialogProps) {
  const t = useT();
  const restore = () => {
    // Restored changes are not saved to a file yet.
    useDocumentStore.getState().loadDocument(entry.document, true);
    onDone();
  };
  return (
    <Modal
      title={t('restore.title')}
      onClose={onDone}
      testId="restore-dialog"
      actions={
        <>
          <button onClick={onDone}>{t('restore.discard')}</button>
          <button className="primary" onClick={restore} data-testid="restore-confirm">
            {t('restore.restore')}
          </button>
        </>
      }
    >
      <p>
        {t('restore.text', {
          name: entry.document.meta.modelName || t('restore.unnamed'),
          time: new Date(entry.savedAt).toLocaleString(),
        })}
      </p>
    </Modal>
  );
}
