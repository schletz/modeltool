import type { Id } from '../../../domain/model/common';
import type { Column, Table } from '../../../domain/model/physical';
import { isIntegerType } from '../../../domain/dataTypes';
import {
  addColumn,
  deleteColumn,
  deleteTable,
  moveColumn,
  renameTable,
  updateColumn,
  type ColumnPatch,
} from '../../../domain/operations/physicalOperations';
import { useDocumentStore } from '../../store/documentStore';
import { useUiStore } from '../../store/uiStore';
import { useT } from '../../i18n/language';
import { tableRows } from '../geometry/displayRows';
import { InlineEditor, type EditorField, type EditorRow } from './InlineEditor';
import { parseNamePrefix } from './namePrefix';

/** Field order: name, PK, data type, NOT NULL, UNIQUE, IDENTITY. */
const FIELD_PATCH: ((value: string | boolean) => ColumnPatch)[] = [
  (v) => ({ name: String(v) }),
  (v) => ({ isPrimaryKey: v === true }),
  (v) => ({ dataType: String(v) }),
  (v) => ({ isNotNull: v === true }),
  (v) => ({ isUnique: v === true }),
  (v) => ({ isIdentity: v === true }),
];

/** Inline editor of a physical table with the additional column properties. */
export function PhysicalEditor({ table }: { table: Table }) {
  const t = useT();
  const commit = useDocumentStore((s) => s.commit);
  const stopEditing = useUiStore((s) => s.stopEditing);
  const showToast = useUiStore((s) => s.showToast);

  const fields: EditorField[] = [
    { label: t('editor.name'), kind: 'text' },
    { label: 'PK', kind: 'toggle', title: t('editor.primaryKey') },
    { label: t('editor.dataType'), kind: 'dataType' },
    { label: 'NN', kind: 'toggle', title: 'NOT NULL' },
    { label: 'U', kind: 'toggle', title: 'UNIQUE' },
    { label: 'ID', kind: 'toggle', title: 'IDENTITY' },
  ];
  const { keyRows, otherRows } = tableRows(table);
  const toRow = (c: Column): EditorRow => ({
    id: c.id,
    values: [c.name, c.isPrimaryKey, c.dataType, c.isNotNull, c.isUnique, c.isIdentity],
    disabled: [false, c.fk !== undefined, false, c.isPrimaryKey, false, !isIntegerType(c.dataType) || c.fk !== undefined],
    deletable: c.fk === undefined,
    isKey: c.isPrimaryKey,
  });

  const onChange = (rowId: Id, field: number, value: string | boolean): void => {
    let patch = FIELD_PATCH[field]?.(value) ?? {};
    let mergeKey: string | undefined;
    if (field === 0 && typeof value === 'string') {
      const parsed = parseNamePrefix(value);
      patch = { name: parsed.name };
      if (parsed.isPrimaryKey) patch.isPrimaryKey = true;
      if (parsed.isOptional) patch.isNotNull = false;
      mergeKey = `col-name:${rowId}`;
    } else if (field === 2) {
      mergeKey = `col-type:${rowId}`;
    }
    commit('physical', (m) => updateColumn(m, table.id, rowId, patch), mergeKey ? { mergeKey } : undefined);
  };

  const onAddRow = (afterRowId: Id | null): Id => {
    let id = '';
    commit('physical', (m) => {
      const [next, newId] = addColumn(m, table.id, afterRowId, { isNotNull: true });
      id = newId;
      return next;
    });
    return id;
  };

  const onClose = (): void => {
    const current = useDocumentStore.getState().doc.physical.tables.find((x) => x.id === table.id);
    if (current && current.name.trim() === '' && current.columns.length === 0) {
      commit('physical', (m) => deleteTable(m, table.id));
    }
    stopEditing();
  };

  return (
    <InlineEditor
      title={table.name}
      titlePlaceholder={t('editor.tableName')}
      fields={fields}
      rows={[...keyRows, ...otherRows].map(toRow)}
      onTitleChange={(name) => commit('physical', (m) => renameTable(m, table.id, name), { mergeKey: `table-name:${table.id}` })}
      onChange={onChange}
      onAddRow={onAddRow}
      onDeleteRow={(rowId) => commit('physical', (m) => deleteColumn(m, table.id, rowId))}
      onDeleteRejected={() => showToast('editor.fkNotDeletable', 'error')}
      onMoveRow={(rowId, direction) => commit('physical', (m) => moveColumn(m, table.id, rowId, direction))}
      onClose={onClose}
    />
  );
}
