import type { Cardinality, Id, Relationship } from '../model/common';
import type { Column, PhysicalModel, Table, UniqueConstraint } from '../model/physical';

/**
 * Column for tests. The id is left empty and filled by `table` as "<Table>.<Column>",
 * so FK origins can reference columns by readable ids.
 */
export function col(name: string, dataType = 'INTEGER', props: Partial<Column> = {}): Column {
  return { id: '', name, dataType, isPrimaryKey: false, isNotNull: false, isUnique: false, isIdentity: false, ...props };
}

/** Primary key column for tests. */
export function pk(name: string, dataType = 'INTEGER', props: Partial<Column> = {}): Column {
  return col(name, dataType, { isPrimaryKey: true, isNotNull: true, ...props });
}

/** FK column for tests, referencing `referencedId` via `relationshipId`. */
export function fkCol(
  name: string,
  relationshipId: Id,
  referencedId: Id,
  dataType = 'INTEGER',
  props: Partial<Column> = {},
): Column {
  return col(name, dataType, {
    isNotNull: true,
    fk: { relationshipId, referencedId, isRenamed: false, isTypeOverridden: false },
    ...props,
  });
}

/** Table for tests with id = name; columns without id get "<Table>.<Column>". */
export function table(name: string, columns: Column[], uniqueConstraints: UniqueConstraint[] = []): Table {
  return {
    id: name,
    name,
    position: { x: 0, y: 0 },
    columns: columns.map((c) => (c.id === '' ? { ...c, id: `${name}.${c.name}` } : c)),
    uniqueConstraints,
  };
}

/** Relationship for tests, default parent `1` at the source and child `0..n` at the target. */
export function rel(
  id: Id,
  sourceId: Id,
  targetId: Id,
  sourceCardinality: Cardinality = 'one',
  targetCardinality: Cardinality = 'zeroOrMany',
  isIdentifying = false,
): Relationship {
  return { id, sourceId, targetId, sourceCardinality, targetCardinality, isIdentifying };
}

/** Physical model for tests without notes. */
export function physical(tables: Table[], relationships: Relationship[] = []): PhysicalModel {
  return { tables, relationships, notes: [] };
}

/** Finds a table by name or fails the test. */
export function tableNamed(model: PhysicalModel, name: string): Table {
  const result = model.tables.find((t) => t.name === name);
  if (!result) throw new Error(`table ${name} not found`);
  return result;
}

/** Finds a column by name or fails the test. */
export function columnNamed(t: Table, name: string): Column {
  const result = t.columns.find((c) => c.name === name);
  if (!result) throw new Error(`column ${t.name}.${name} not found`);
  return result;
}
