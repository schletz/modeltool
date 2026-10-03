import { resolveRoles } from '../cardinality';
import type { Column, PhysicalModel, Table } from '../model/physical';

/** Parent table and primary key column an FK column refers to. */
export interface ReferencedColumn {
  table: Table;
  column: Column;
}

/** Resolves the column an FK column references; undefined for normal or dangling columns. */
export function referencedColumn(model: PhysicalModel, column: Column): ReferencedColumn | undefined {
  const fk = column.fk;
  const rel = fk && model.relationships.find((r) => r.id === fk.relationshipId);
  const roles = rel && resolveRoles(rel);
  if (!fk || !roles || roles.kind === 'manyToMany') return undefined;
  const table = model.tables.find((t) => t.id === roles.parentId);
  const referenced = table?.columns.find((c) => c.id === fk.referencedId);
  return table && referenced ? { table, column: referenced } : undefined;
}
