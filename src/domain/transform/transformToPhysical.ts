import { syncPhysicalForeignKeys } from '../foreignKeys/physicalForeignKeys';
import type { Id } from '../model/common';
import type { ModelSettings } from '../model/document';
import type { GeneralizationStrategy, LogicalModel } from '../model/logical';
import type { PhysicalModel, Table } from '../model/physical';
import { buildColumns } from './columnMapping';
import { mapForeignKeyRelationships } from './foreignKeyRelationships';
import { resolveJunctionTables } from './junctionTables';
import { addOneToOneUniques } from './oneToOneUniques';
import { preservePrevious } from './preservation';
import { planTables } from './tablePlan';

/**
 * Transforms a valid logical model into a new physical model (spec 4).
 * `previous` is the existing physical model whose positions, column properties and
 * notes are preserved by table/column name (spec 4.5).
 *
 * The logical model is expected to be FK-synced. Generalizations without an entry in
 * `strategies` are rolled up. Logical notes are not taken over.
 */
export function transformToPhysical(
  logical: LogicalModel,
  settings: ModelSettings,
  strategies: Readonly<Record<Id, GeneralizationStrategy>>,
  previous?: PhysicalModel,
): PhysicalModel {
  const convention = settings.namingConvention;
  const plan = planTables(logical, strategies);
  const foreignKeys = mapForeignKeyRelationships(logical.relationships, plan);
  const junctions = resolveJunctionTables(
    logical.relationships,
    new Map(logical.entities.map((e) => [e.id, e])),
    plan,
    plan.tables.map((t) => t.name),
    convention,
  );
  const columns = buildColumns(plan.tables, foreignKeys.mappedForeignKey);
  const entityTables = plan.tables.map(
    (t): Table => ({ id: t.id, name: t.name, position: t.position, columns: columns.get(t.id) ?? [], uniqueConstraints: [] }),
  );

  // The first sync generates the FK columns that have no logical counterpart (junction
  // tables, rolled down parents) and aligns names; the last one propagates preserved types.
  let model: PhysicalModel = syncPhysicalForeignKeys(
    {
      tables: [...entityTables, ...junctions.tables],
      relationships: [...foreignKeys.relationships, ...junctions.relationships],
      notes: previous?.notes ?? [],
    },
    convention,
  );
  if (previous) model = preservePrevious(model, previous);
  model = addOneToOneUniques(model);
  return syncPhysicalForeignKeys(model, convention);
}
