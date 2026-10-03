import { isOptionalEnd, resolveRoles } from '../cardinality';
import { newId } from '../ids';
import type { Cardinality, Id, NamingConvention, Point, Relationship } from '../model/common';
import type { Entity } from '../model/logical';
import type { Table } from '../model/physical';
import { junctionTableName, uniqueName } from '../naming';
import type { PlannedTable, TablePlan } from './tablePlan';

/** Horizontal offset of the junction table of a recursive n:m relationship. */
const RECURSIVE_OFFSET_X = 320;

/** Junction tables and their identifying relationships. */
export interface JunctionTables {
  tables: Table[];
  relationships: Relationship[];
}

/**
 * Resolves the n:m relationships into junction tables (spec 4.3). The junction table has no
 * columns yet; its key consists of the FK columns of two identifying relationships, which the
 * FK sync generates (a recursive relationship yields "PersonId" and "PersonId2").
 * `takenTableNames` are the names of the other tables, junction names are made unique against them.
 */
export function resolveJunctionTables(
  logical: readonly Relationship[],
  entities: ReadonlyMap<Id, Entity>,
  plan: TablePlan,
  takenTableNames: readonly string[],
  convention: NamingConvention,
): JunctionTables {
  const result: JunctionTables = { tables: [], relationships: [] };
  const taken = [...takenTableNames];

  for (const rel of logical) {
    if (resolveRoles(rel).kind !== 'manyToMany') continue;
    const sourceTables = plan.tablesOf(rel.sourceId);
    const targetTables = plan.tablesOf(rel.targetId);
    // An end that maps to several tables (rolled down supertype) gets one junction table per table.
    const endName = (entityId: Id, tables: PlannedTable[], table: PlannedTable): string =>
      tables.length === 1 ? (entities.get(entityId)?.name ?? table.name) : table.name;

    for (const source of sourceTables) {
      for (const target of targetTables) {
        const name = uniqueName(
          junctionTableName(endName(rel.sourceId, sourceTables, source), endName(rel.targetId, targetTables, target), convention),
          taken,
        );
        taken.push(name);
        const junction: Table = { id: newId(), name, position: junctionPosition(source, target), columns: [], uniqueConstraints: [] };
        result.tables.push(junction);
        // Rows of the junction table per parent row = the original cardinality at the opposite end.
        result.relationships.push(
          junctionRelationship(source, junction, rel.targetCardinality),
          junctionRelationship(target, junction, rel.sourceCardinality),
        );
      }
    }
  }
  return result;
}

function junctionRelationship(parent: PlannedTable, junction: Table, oppositeEnd: Cardinality): Relationship {
  return {
    id: newId(),
    sourceId: parent.id,
    targetId: junction.id,
    sourceCardinality: 'one',
    targetCardinality: isOptionalEnd(oppositeEnd) ? 'zeroOrMany' : 'oneOrMany',
    isIdentifying: true,
  };
}

/** Midpoint between the two parent tables; a recursive junction is placed beside its table. */
function junctionPosition(a: PlannedTable, b: PlannedTable): Point {
  if (a.id === b.id) return { x: a.position.x + RECURSIVE_OFFSET_X, y: a.position.y };
  return { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 };
}
