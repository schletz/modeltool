import { useState } from 'react';
import { hasPhysicalModel } from '../../domain/model/document';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';
import { useT } from '../i18n/language';
import { preselectedStrategies, runTransformation, type Strategies } from '../commands/transformCommands';
import { Modal } from './Modal';

/** Asks for the strategy of every generalization and warns before overwriting (spec 4.1). */
export function TransformDialog() {
  const t = useT();
  const doc = useDocumentStore((s) => s.doc);
  const close = () => useUiStore.getState().openDialog(null);
  const [strategies, setStrategies] = useState<Strategies>(preselectedStrategies);
  const overwrite = hasPhysicalModel(doc);
  const nameOf = (id: string) => doc.logical.entities.find((e) => e.id === id)?.name || '?';

  return (
    <Modal
      title={t('transform.title')}
      onClose={close}
      testId="transform-dialog"
      actions={
        <>
          <button onClick={close}>{t('common.cancel')}</button>
          <button className="primary" onClick={() => runTransformation(strategies)} data-testid="transform-confirm">
            {overwrite ? t('transform.overwrite') : t('transform.run')}
          </button>
        </>
      }
    >
      {doc.logical.generalizations.length === 0 && !overwrite && <p>{t('transform.ready')}</p>}
      {doc.logical.generalizations.map((g) => (
        <fieldset key={g.id} className="strategy">
          <legend>
            {nameOf(g.supertypeId)} → {g.subtypeIds.map(nameOf).join(', ')}
            {!g.isComplete && ` (${t('generalization.incomplete')})`}
          </legend>
          {(['rollUp', 'rollDown'] as const).map((s) => (
            <label key={s} className="toggle">
              <input
                type="radio"
                name={`strategy-${g.id}`}
                checked={strategies[g.id] === s}
                onChange={() => setStrategies({ ...strategies, [g.id]: s })}
              />
              <span>
                <strong>{t(`transform.${s}`)}</strong> – {t(`transform.${s}Hint`)}
              </span>
            </label>
          ))}
        </fieldset>
      ))}
      {overwrite && <p className="warning">{t('transform.overwriteWarning')}</p>}
    </Modal>
  );
}
