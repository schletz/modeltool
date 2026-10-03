import { Panel } from '@xyflow/react';
import {
  addUniqueConstraint,
  deleteUniqueConstraint,
  updateUniqueConstraint,
} from '../../domain/operations/physicalOperations';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';
import { useT } from '../i18n/language';

/** Table wide settings of the selected table: named UNIQUE constraints over several columns. */
export function TablePropertiesPanel() {
  const t = useT();
  const view = useUiStore((s) => s.view);
  const selection = useUiStore((s) => s.selection);
  const tables = useDocumentStore((s) => s.doc.physical.tables);
  const commit = useDocumentStore((s) => s.commit);
  if (view !== 'physical' || selection?.kind !== 'node') return null;
  const table = tables.find((x) => x.id === selection.id);
  if (!table) return null;

  return (
    <Panel position="top-right" className="properties-panel" data-testid="table-properties">
      <h3>{t('unique.title', { table: table.name || '?' })}</h3>
      {table.uniqueConstraints.length === 0 && <p className="hint">{t('unique.none')}</p>}
      {table.uniqueConstraints.map((u) => (
        <fieldset key={u.id} className="unique-constraint">
          <div className="unique-head">
            <input
              value={u.name}
              aria-label={t('unique.name')}
              onChange={(e) =>
                commit('physical', (m) => updateUniqueConstraint(m, table.id, u.id, { name: e.target.value }), { mergeKey: `uq:${u.id}` })
              }
            />
            <button className="danger small" onClick={() => commit('physical', (m) => deleteUniqueConstraint(m, table.id, u.id))}>
              ✕
            </button>
          </div>
          {table.columns.map((c) => (
            <label key={c.id} className="toggle">
              <input
                type="checkbox"
                checked={u.columnIds.includes(c.id)}
                onChange={(e) => {
                  const columnIds = e.target.checked ? [...u.columnIds, c.id] : u.columnIds.filter((id) => id !== c.id);
                  commit('physical', (m) => updateUniqueConstraint(m, table.id, u.id, { columnIds }));
                }}
              />
              {c.name || '?'}
            </label>
          ))}
        </fieldset>
      ))}
      <button onClick={() => commit('physical', (m) => addUniqueConstraint(m, table.id))}>+ {t('unique.add')}</button>
    </Panel>
  );
}
