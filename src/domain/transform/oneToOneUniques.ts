import { resolveRoles } from '../cardinality';
import { newId } from '../ids';
import type { Id } from '../model/common';
import type { PhysicalModel, Table } from '../model/physical';
import { uniqueName } from '../naming';

/**
 * Makes the FK columns of every 1:1 relationship UNIQUE (spec 4.2), unless the child's whole
 * primary key is among them (then they are unique already). One column gets the column flag,
 * several columns get a named constraint UQ_<Table>_<Col1>_<Col2>.
 */
export function addOneToOneUniques(model: PhysicalModel): PhysicalModel {
  let tables = model.tables;
  for (const rel of model.relationships) {
    const roles = resolveRoles(rel);
    if (roles.kind !== 'oneToOne') continue;
    tables = tables.map((t) => (t.id === roles.childId ? withUniqueForeignKey(t, rel.id) : t));
  }
  return tables === model.tables ? model : { ...model, tables };
}

function withUniqueForeignKey(table: Table, relationshipId: Id): Table {
  const fkColumns = table.columns.filter((c) => c.fk?.relationshipId === relationshipId);
  const keyColumns = table.columns.filter((c) => c.isPrimaryKey);
  if (fkColumns.length === 0) return table;
  if (keyColumns.length > 0 && keyColumns.every((c) => fkColumns.includes(c))) return table;

  const [single] = fkColumns;
  if (fkColumns.length === 1 && single) {
    return { ...table, columns: table.columns.map((c) => (c.id === single.id ? { ...c, isUnique: true } : c)) };
  }
  const name = uniqueName(
    `UQ_${table.name}_${fkColumns.map((c) => c.name).join('_')}`,
    table.uniqueConstraints.map((u) => u.name),
  );
  return { ...table, uniqueConstraints: [...table.uniqueConstraints, { id: newId(), name, columnIds: fkColumns.map((c) => c.id) }] };
}
