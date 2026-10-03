import type { NamingConvention } from '../../domain/model/common';
import type { ModelMeta } from '../../domain/model/document';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';
import { useT } from '../i18n/language';
import type { MessageKey } from '../i18n/messages';
import { Modal } from './Modal';

const META_FIELDS: { key: Exclude<keyof ModelMeta, 'savedAt'>; label: MessageKey }[] = [
  { key: 'modelName', label: 'meta.modelName' },
  { key: 'studentName', label: 'meta.studentName' },
  { key: 'className', label: 'meta.className' },
  { key: 'studentId', label: 'meta.studentIdOptional' },
];

/** Model settings: metadata and naming convention (spec 6). */
export function SettingsDialog() {
  const t = useT();
  const meta = useDocumentStore((s) => s.doc.meta);
  const convention = useDocumentStore((s) => s.doc.settings.namingConvention);
  const setMeta = useDocumentStore((s) => s.setMeta);
  const setSettings = useDocumentStore((s) => s.setSettings);
  const close = () => useUiStore.getState().openDialog(null);

  return (
    <Modal title={t('settings.title')} onClose={close} testId="settings-dialog" actions={<button className="primary" onClick={close}>{t('common.close')}</button>}>
      <div className="form-grid">
        {META_FIELDS.map((f) => (
          <label key={f.key}>
            <span>{t(f.label)}</span>
            <input value={meta[f.key]} onChange={(e) => setMeta({ [f.key]: e.target.value })} data-testid={`meta-${f.key}`} />
          </label>
        ))}
        <label>
          <span>{t('settings.naming')}</span>
          <select value={convention} onChange={(e) => setSettings({ namingConvention: e.target.value as NamingConvention })}>
            <option value="PascalCase">PascalCase (StudentId, StudentCourse)</option>
            <option value="snake_case">snake_case (student_id, student_course)</option>
          </select>
        </label>
        {meta.savedAt && (
          <p className="hint">
            {t('meta.savedAt')}: {new Date(meta.savedAt).toLocaleString()}
          </p>
        )}
      </div>
    </Modal>
  );
}
