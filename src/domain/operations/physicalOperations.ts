import type { Id, Point } from '../model/common';
import type { Column, PhysicalModel, Table, UniqueConstraint } from '../model/physical';
import { newId } from '../ids';
import { isIntegerType, sameDataType } from '../dataTypes';
import { insertAfter, moveWithinGroup, patchById } from './memberList';
import { deleteRelationshipsOf } from './relationshipOperations';

export function addTable(model: PhysicalModel, position: Point, name = ''): [PhysicalModel, Id] {
  const table: Table = { id: newId(), name, position, columns: [], uniqueConstraints: [] };
  return [{ ...model, tables: [...model.tables, table] }, table.id];
}

function mapTable(model: PhysicalModel, tableId: Id, fn: (t: Table) => Table): PhysicalModel {
  return { ...model, tables: model.tables.map((t) => (t.id === tableId ? fn(t) : t)) };
}

export function renameTable(model: PhysicalModel, tableId: Id, name: string): PhysicalModel {
  return mapTable(model, tableId, (t) => ({ ...t, name }));
}

export function moveTables(model: PhysicalModel, positions: ReadonlyMap<Id, Point>): PhysicalModel {
  return {
    ...model,
    tables: model.tables.map((t) => {
      const p = positions.get(t.id);
      return p ? { ...t, position: p } : t;
    }),
  };
}

export function addColumn(
  model: PhysicalModel,
  tableId: Id,
  afterId: Id | null,
  init: Partial<Omit<Column, 'id'>> = {},
): [PhysicalModel, Id] {
  const column: Column = {
    id: newId(),
    name: '',
    dataType: '',
    isPrimaryKey: false,
    isNotNull: false,
    isUnique: false,
    isIdentity: false,
    ...init,
  };
  if (column.isPrimaryKey) column.isNotNull = true;
  return [mapTable(model, tableId, (t) => ({ ...t, columns: insertAfter(t.columns, afterId, column) })), column.id];
}

export type ColumnPatch = Partial<Pick<Column, 'name' | 'dataType' | 'isPrimaryKey' | 'isNotNull' | 'isUnique' | 'isIdentity'>>;

/**
 * Updates a column and keeps its invariants: PK columns are NOT NULL, IDENTITY needs an
 * integer type, a renamed FK column keeps its name, and a FK column whose type differs
 * from the referenced column no longer follows it.
 */
export function updateColumn(model: PhysicalModel, tableId: Id, columnId: Id, patch: ColumnPatch): PhysicalModel {
  return mapTable(model, tableId, (t) => ({
    ...t,
    columns: t.columns.map((c) => {
      if (c.id !== columnId) return c;
      // Keys of FK columns follow the relationship (identifying or not).
      const { isPrimaryKey: _keyFollowsRelationship, ...rest } = patch;
      const next: Column = { ...c, ...(c.fk ? rest : patch) };
      if (next.isPrimaryKey) next.isNotNull = true;
      if (next.isIdentity && !isIntegerType(next.dataType)) next.isIdentity = false;
      if (c.fk) {
        let fk = c.fk;
        if (patch.name !== undefined && patch.name !== c.name) fk = { ...fk, isRenamed: true };
        if (patch.dataType !== undefined) {
          const referenced = findColumn(model, fk.referencedId);
          fk = { ...fk, isTypeOverridden: !referenced || !sameDataType(patch.dataType, referenced.dataType) };
        }
        next.fk = fk;
      }
      return next;
    }),
  }));
}

function findColumn(model: PhysicalModel, columnId: Id): Column | undefined {
  for (const t of model.tables) {
    const c = t.columns.find((col) => col.id === columnId);
    if (c) return c;
  }
  return undefined;
}

export function moveColumn(model: PhysicalModel, tableId: Id, columnId: Id, direction: -1 | 1): PhysicalModel {
  return mapTable(model, tableId, (t) => ({
    ...t,
    columns: moveWithinGroup(t.columns, columnId, direction, (a, b) => a.isPrimaryKey === b.isPrimaryKey),
  }));
}

/** Deletes a column (not generated FK columns) and removes it from unique constraints. */
export function deleteColumn(model: PhysicalModel, tableId: Id, columnId: Id): PhysicalModel {
  return mapTable(model, tableId, (t) => {
    if (t.columns.some((c) => c.id === columnId && c.fk)) return t;
    return {
      ...t,
      columns: t.columns.filter((c) => c.id !== columnId),
      uniqueConstraints: t.uniqueConstraints
        .map((u) => ({ ...u, columnIds: u.columnIds.filter((id) => id !== columnId) })),
    };
  });
}

export function deleteTable(model: PhysicalModel, tableId: Id): PhysicalModel {
  const withoutRels = deleteRelationshipsOf(model, tableId);
  return { ...withoutRels, tables: withoutRels.tables.filter((t) => t.id !== tableId) };
}

export function addUniqueConstraint(model: PhysicalModel, tableId: Id): PhysicalModel {
  return mapTable(model, tableId, (t) => {
    const constraint: UniqueConstraint = { id: newId(), name: `UQ_${t.name}_${t.uniqueConstraints.length + 1}`, columnIds: [] };
    return { ...t, uniqueConstraints: [...t.uniqueConstraints, constraint] };
  });
}

export function updateUniqueConstraint(
  model: PhysicalModel,
  tableId: Id,
  constraintId: Id,
  patch: Partial<Omit<UniqueConstraint, 'id'>>,
): PhysicalModel {
  return mapTable(model, tableId, (t) => ({ ...t, uniqueConstraints: patchById(t.uniqueConstraints, constraintId, patch) }));
}

export function deleteUniqueConstraint(model: PhysicalModel, tableId: Id, constraintId: Id): PhysicalModel {
  return mapTable(model, tableId, (t) => ({ ...t, uniqueConstraints: t.uniqueConstraints.filter((u) => u.id !== constraintId) }));
}
