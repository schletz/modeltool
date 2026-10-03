import { newId } from '../ids';
import type { Id, Point } from '../model/common';
import type { Entity, Generalization, GeneralizationStrategy, LogicalAttribute, LogicalModel } from '../model/logical';

/** Logical attribute that becomes a column of a planned table. */
export interface PlannedMember {
  attribute: LogicalAttribute;
  /** Forces a NULLable, non key column (attributes of rolled up subtypes). */
  isForcedNullable: boolean;
}

/** A table to be created for one entity, before columns are built. */
export interface PlannedTable {
  id: Id;
  name: string;
  position: Point;
  /** Attributes in column order. */
  members: PlannedMember[];
}

/** Which tables the entities of the logical model are mapped to (spec 4.2, 4.4). */
export interface TablePlan {
  /** Tables in entity order. */
  tables: PlannedTable[];
  /** Tables an entity ends up in: several for a rolled down supertype, the supertype's for a rolled up subtype. */
  tablesOf(entityId: Id): PlannedTable[];
  /** True if the entity is a subtype rolled up into its supertype's table. */
  isRolledUp(entityId: Id): boolean;
}

/**
 * Plans one table per entity, applying the generalization strategies (default roll up):
 * roll up merges the subtypes' attributes as NULLable columns into the supertype table,
 * roll down drops the supertype and copies its attributes into every subtype table.
 */
export function planTables(logical: LogicalModel, strategies: Readonly<Record<Id, GeneralizationStrategy>>): TablePlan {
  const entities = new Map(logical.entities.map((e) => [e.id, e]));
  const bySupertype = new Map(logical.generalizations.map((g) => [g.supertypeId, g]));
  const bySubtype = new Map(logical.generalizations.flatMap((g) => g.subtypeIds.map((s) => [s, g] as const)));
  const strategyOf = (g: Generalization | undefined): GeneralizationStrategy | undefined =>
    g ? (strategies[g.id] ?? 'rollUp') : undefined;
  const ownMembers = (e: Entity | undefined, isForcedNullable: boolean): PlannedMember[] =>
    (e?.attributes ?? []).map((attribute) => ({ attribute, isForcedNullable }));

  const tableByEntity = new Map<Id, PlannedTable>();
  for (const entity of logical.entities) {
    const asSubtype = bySubtype.get(entity.id);
    const asSupertype = bySupertype.get(entity.id);
    if (strategyOf(asSubtype) === 'rollUp' || strategyOf(asSupertype) === 'rollDown') continue;

    let members = ownMembers(entity, false);
    if (asSubtype) {
      members = [...ownMembers(entities.get(asSubtype.supertypeId), false), ...members];
    } else if (asSupertype) {
      members = [...members, ...asSupertype.subtypeIds.flatMap((id) => ownMembers(entities.get(id), true))];
    }
    tableByEntity.set(entity.id, { id: newId(), name: entity.name, position: entity.position, members });
  }

  const tablesOf = (entityId: Id): PlannedTable[] => {
    const asSubtype = bySubtype.get(entityId);
    if (asSubtype && strategyOf(asSubtype) === 'rollUp') return tablesOf(asSubtype.supertypeId);
    const asSupertype = bySupertype.get(entityId);
    if (asSupertype && strategyOf(asSupertype) === 'rollDown') return asSupertype.subtypeIds.flatMap(tablesOf);
    const table = tableByEntity.get(entityId);
    return table ? [table] : [];
  };

  return {
    tables: [...tableByEntity.values()],
    tablesOf,
    isRolledUp: (entityId) => strategyOf(bySubtype.get(entityId)) === 'rollUp',
  };
}
