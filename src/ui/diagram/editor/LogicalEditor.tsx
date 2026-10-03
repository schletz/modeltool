import type { Id } from '../../../domain/model/common';
import type { Entity, LogicalAttribute } from '../../../domain/model/logical';
import {
  addAttribute,
  deleteAttribute,
  deleteEntity,
  moveAttribute,
  renameEntity,
  updateAttribute,
} from '../../../domain/operations/logicalOperations';
import { useDocumentStore } from '../../store/documentStore';
import { useUiStore } from '../../store/uiStore';
import { useT } from '../../i18n/language';
import { entityRows } from '../geometry/displayRows';
import { InlineEditor, type EditorField, type EditorRow } from './InlineEditor';
import { parseNamePrefix } from './namePrefix';

const NAME = 0;
const PRIMARY_KEY = 1;
const OPTIONAL = 2;

/** Inline editor of a logical entity: name, PK and optional per attribute. */
export function LogicalEditor({ entity }: { entity: Entity }) {
  const t = useT();
  const model = useDocumentStore((s) => s.doc.logical);
  const commit = useDocumentStore((s) => s.commit);
  const stopEditing = useUiStore((s) => s.stopEditing);
  const showToast = useUiStore((s) => s.showToast);
  const isSubtype = model.generalizations.some((g) => g.subtypeIds.includes(entity.id));

  const fields: EditorField[] = [
    { label: t('editor.name'), kind: 'text' },
    { label: 'PK', kind: 'toggle', title: t('editor.primaryKey') },
    { label: 'o', kind: 'toggle', title: t('editor.optional') },
  ];
  const { keyRows, otherRows } = entityRows(model, entity);
  const byId = new Map(entity.attributes.map((a) => [a.id, a]));
  const toRow = (a: LogicalAttribute): EditorRow => ({
    id: a.id,
    values: [a.name, a.isPrimaryKey, a.isOptional],
    // Keys and optionality of generated FKs follow the relationship; subtypes have no own key.
    disabled: [false, a.fk !== undefined || isSubtype, a.fk !== undefined || a.isPrimaryKey],
    deletable: a.fk === undefined,
    isKey: a.isPrimaryKey,
  });
  const rows = [...keyRows, ...otherRows]
    .filter((r) => !r.isInherited)
    .map((r) => byId.get(r.id))
    .filter((a): a is LogicalAttribute => a !== undefined)
    .map(toRow);

  const onChange = (rowId: Id, field: number, value: string | boolean): void => {
    if (field === NAME && typeof value === 'string') {
      const { name, isPrimaryKey, isOptional } = parseNamePrefix(value);
      const patch: Parameters<typeof updateAttribute>[3] = { name };
      if (isPrimaryKey && !isSubtype) patch.isPrimaryKey = true;
      if (isOptional) patch.isOptional = true;
      commit('logical', (m) => updateAttribute(m, entity.id, rowId, patch), { mergeKey: `attr-name:${rowId}` });
    } else if (field === PRIMARY_KEY) {
      commit('logical', (m) => updateAttribute(m, entity.id, rowId, { isPrimaryKey: value === true }));
    } else if (field === OPTIONAL) {
      commit('logical', (m) => updateAttribute(m, entity.id, rowId, { isOptional: value === true }));
    }
  };

  const onAddRow = (afterRowId: Id | null): Id => {
    let id = '';
    commit('logical', (m) => {
      const [next, newId] = addAttribute(m, entity.id, afterRowId);
      id = newId;
      return next;
    });
    return id;
  };

  const onClose = (): void => {
    // An entity created by double click and left empty is discarded.
    const current = useDocumentStore.getState().doc.logical.entities.find((e) => e.id === entity.id);
    if (current && current.name.trim() === '' && current.attributes.length === 0) {
      commit('logical', (m) => deleteEntity(m, entity.id));
    }
    stopEditing();
  };

  return (
    <InlineEditor
      title={entity.name}
      titlePlaceholder={t('editor.entityName')}
      fields={fields}
      rows={rows}
      staticRows={keyRows
        .filter((r) => r.isInherited)
        .map((r) => (
          <div key={r.id} className="editor-row inherited">
            <span className="key-marker">PK</span>
            <span>{r.name}</span>
          </div>
        ))}
      onTitleChange={(name) => commit('logical', (m) => renameEntity(m, entity.id, name), { mergeKey: `entity-name:${entity.id}` })}
      onChange={onChange}
      onAddRow={onAddRow}
      onDeleteRow={(rowId) => commit('logical', (m) => deleteAttribute(m, entity.id, rowId))}
      onDeleteRejected={() => showToast('editor.fkNotDeletable', 'error')}
      onMoveRow={(rowId, direction) => commit('logical', (m) => moveAttribute(m, entity.id, rowId, direction))}
      onClose={onClose}
    />
  );
}
