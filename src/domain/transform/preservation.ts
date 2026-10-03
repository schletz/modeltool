import { sameDataType } from '../dataTypes';
import { referencedColumn } from '../foreignKeys/referencedColumn';
import type { Id } from '../model/common';
import type { Column, PhysicalModel, Table } from '../model/physical';

/**
 * Takes over what the user set in the previous physical model, matched by table and column
 * name (spec 4.5): table position, column data type, UNIQUE and IDENTITY. A preserved FK
 * column type that differs from the referenced column's type is marked as overridden, so the
 * FK sync does not overwrite it. Notes are handled by the caller.
 */
export function preservePrevious(model: PhysicalModel, previous: PhysicalModel): PhysicalModel {
  const previousTables = new Map(previous.tables.map((t) => [t.name, t]));
  const preservedTypes = new Set<Id>();

  const tables = model.tables.map((table): Table => {
    const old = previousTables.get(table.name);
    if (!old) return table;
    const oldColumns = new Map(old.columns.map((c) => [c.name, c]));
    const columns = table.columns.map((column): Column => {
      const oldColumn = oldColumns.get(column.name);
      if (!oldColumn) return column;
      if (oldColumn.dataType !== '') preservedTypes.add(column.id);
      return {
        ...column,
        dataType: oldColumn.dataType || column.dataType,
        isUnique: oldColumn.isUnique,
        isIdentity: oldColumn.isIdentity,
      };
    });
    return { ...table, position: old.position, columns };
  });

  return markOverriddenTypes({ ...model, tables }, preservedTypes);
}

/** Sets isTypeOverridden on preserved FK columns whose type differs from the referenced column. */
function markOverriddenTypes(model: PhysicalModel, preservedTypes: ReadonlySet<Id>): PhysicalModel {
  const tables = model.tables.map((table) => ({
    ...table,
    columns: table.columns.map((column) => {
      if (!column.fk || !preservedTypes.has(column.id)) return column;
      const referenced = referencedColumn(model, column);
      if (!referenced || sameDataType(referenced.column.dataType, column.dataType)) return column;
      return { ...column, fk: { ...column.fk, isTypeOverridden: true } };
    }),
  }));
  return { ...model, tables };
}
