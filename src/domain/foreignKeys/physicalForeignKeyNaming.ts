import type { Id, NamingConvention } from '../model/common';
import type { Column, Table } from '../model/physical';
import { foreignKeyName, uniqueName } from '../naming';

/**
 * Assigns the automatic names of all generated, not renamed FK columns of a table.
 *
 * The base name reuses the referenced column's name if that column is itself an FK
 * (identifying chains keep "SchoolId" instead of "ClassSchoolId"), otherwise it is built
 * from parent table and referenced column. Collisions get a number. Names of normal and
 * renamed columns are taken first; then key columns are named before the others, each in
 * table order, so later non identifying FKs never rename a key column referenced elsewhere.
 */
export function nameForeignKeyColumns(
  table: Table,
  parentTableOf: (relationshipId: Id) => Table | undefined,
  convention: NamingConvention,
): Table {
  const isAutoNamed = (c: Column): boolean => c.fk !== undefined && !c.fk.isRenamed;
  const taken = table.columns.filter((c) => !isAutoNamed(c)).map((c) => c.name);
  const autoNamed = table.columns.filter(isAutoNamed);
  const ordered = [...autoNamed.filter((c) => c.isPrimaryKey), ...autoNamed.filter((c) => !c.isPrimaryKey)];

  const names = new Map<Id, string>();
  for (const column of ordered) {
    const name = uniqueName(baseName(column, parentTableOf, convention), taken);
    taken.push(name);
    names.set(column.id, name);
  }
  if (table.columns.every((c) => (names.get(c.id) ?? c.name) === c.name)) return table;
  return { ...table, columns: table.columns.map((c) => ({ ...c, name: names.get(c.id) ?? c.name })) };
}

function baseName(
  column: Column,
  parentTableOf: (relationshipId: Id) => Table | undefined,
  convention: NamingConvention,
): string {
  if (!column.fk) return column.name;
  const parent = parentTableOf(column.fk.relationshipId);
  const referenced = parent?.columns.find((c) => c.id === column.fk?.referencedId);
  if (!parent || !referenced) return column.name;
  return referenced.fk ? referenced.name : foreignKeyName(parent.name, referenced.name, convention);
}
