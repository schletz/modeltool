import { resolveRoles } from '../cardinality';
import type { Column, PhysicalModel, Table } from '../model/physical';

/** FOREIGN KEY constraint of a child table, columns in the order of the referenced primary key. */
export interface ForeignKeyConstraint {
  child: Table;
  parent: Table;
  columns: Column[];
  referencedColumns: Column[];
}

/** Collects the FK constraints of all tables (one per 1:n/1:1 relationship with FK columns), in relationship order. */
export function foreignKeyConstraints(model: PhysicalModel): ForeignKeyConstraint[] {
  const tables = new Map(model.tables.map((t) => [t.id, t]));
  const result: ForeignKeyConstraint[] = [];
  for (const rel of model.relationships) {
    const roles = resolveRoles(rel);
    if (roles.kind === 'manyToMany') continue;
    const child = tables.get(roles.childId);
    const parent = tables.get(roles.parentId);
    if (!child || !parent) continue;

    const parentKey = parent.columns.filter((c) => c.isPrimaryKey);
    const pairs = child.columns
      .filter((c) => c.fk?.relationshipId === rel.id)
      .map((column) => ({ column, referenced: parentKey.find((k) => k.id === column.fk?.referencedId) }))
      .filter((p): p is { column: Column; referenced: Column } => p.referenced !== undefined)
      .sort((a, b) => parentKey.indexOf(a.referenced) - parentKey.indexOf(b.referenced));
    if (pairs.length === 0) continue;
    result.push({ child, parent, columns: pairs.map((p) => p.column), referencedColumns: pairs.map((p) => p.referenced) });
  }
  return result;
}
