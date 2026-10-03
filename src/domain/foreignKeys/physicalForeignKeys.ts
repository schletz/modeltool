import { resolveRoles } from '../cardinality';
import { stronglyConnectedComponents } from '../graph/stronglyConnectedComponents';
import { newId } from '../ids';
import type { Cardinality, Id, NamingConvention, Relationship } from '../model/common';
import type { Column, PhysicalModel, Table } from '../model/physical';
import { nameForeignKeyColumns } from './physicalForeignKeyNaming';

/** A 1:n or 1:1 relationship between two existing tables, seen from parent and child. */
interface ForeignKeyLink {
  relationship: Relationship;
  parentId: Id;
  childId: Id;
  parentCardinality: Cardinality;
}

/** Working state of one sync run: tables by id, replaced immutably step by step. */
type TableMap = Map<Id, Table>;

/**
 * Recomputes all generated FK columns of the physical model and returns a new model.
 * Must be called after every change; it is idempotent.
 *
 * For every 1:n and 1:1 relationship the child table gets one FK column per primary key
 * column of the parent. Existing FK columns keep id, position, NOT NULL and UNIQUE (and the
 * name once renamed); their data type follows the referenced column unless overridden.
 * Identifying relationships make the FK columns part of the child's primary key, which is
 * propagated transitively along identifying chains.
 */
export function syncPhysicalForeignKeys(model: PhysicalModel, convention: NamingConvention): PhysicalModel {
  const links = foreignKeyLinks(model);
  const tables: TableMap = new Map(model.tables.map((t) => [t.id, removeOrphanedForeignKeys(t, links)]));
  const parentOf = new Map(links.map((l) => [l.relationship.id, l.parentId]));
  const sync = (link: ForeignKeyLink, excluded: ReadonlySet<Id>): void => {
    syncLink(tables, link, excluded);
    const child = tables.get(link.childId) as Table;
    tables.set(child.id, nameForeignKeyColumns(child, (relId) => tables.get(parentOf.get(relId) ?? ''), convention));
  };

  // Identifying links change the parent key of further children, so they run in
  // dependency order. Non identifying FK columns are never referenced and run last.
  const identifying = links.filter((l) => l.relationship.isIdentifying);
  const components = stronglyConnectedComponents(
    model.tables.map((t) => t.id),
    identifying.map((l) => ({ from: l.parentId, to: l.childId })),
  );
  for (const component of components) {
    const members = new Set(component);
    const inbound = identifying.filter((l) => members.has(l.childId) && !members.has(l.parentId));
    const internal = identifying.filter((l) => members.has(l.childId) && members.has(l.parentId));
    for (const link of inbound) sync(link, new Set());
    // Inside an identifying cycle the parent key would grow with every run. Referencing only
    // the key columns that do not stem from the cycle itself keeps the result stable.
    const cycleRelationships = new Set(internal.map((l) => l.relationship.id));
    for (const link of internal) sync(link, cycleRelationships);
  }
  for (const link of links) if (!link.relationship.isIdentifying) sync(link, new Set());

  return { ...model, tables: model.tables.map((t) => tables.get(t.id) as Table) };
}

/**
 * Sets NOT NULL of the FK columns of one relationship from the cardinality at its parent
 * end: identifying or 'one' -> NOT NULL, otherwise NULL. The UI calls it when the user
 * changes a cardinality in the physical view (NOT NULL stays editable afterwards).
 */
export function applyParentCardinalityToForeignKeys(model: PhysicalModel, relationshipId: Id): PhysicalModel {
  const relationship = model.relationships.find((r) => r.id === relationshipId);
  if (!relationship) return model;
  const roles = resolveRoles(relationship);
  if (roles.kind === 'manyToMany') return model;
  const isNotNull = relationship.isIdentifying || roles.parentCardinality === 'one';
  return {
    ...model,
    tables: model.tables.map((t) =>
      t.id !== roles.childId
        ? t
        : { ...t, columns: t.columns.map((c) => (c.fk?.relationshipId === relationshipId ? { ...c, isNotNull } : c)) },
    ),
  };
}

/** All 1:n and 1:1 relationships whose two tables exist, in model order. */
function foreignKeyLinks(model: PhysicalModel): ForeignKeyLink[] {
  const tableIds = new Set(model.tables.map((t) => t.id));
  const links: ForeignKeyLink[] = [];
  for (const relationship of model.relationships) {
    const roles = resolveRoles(relationship);
    if (roles.kind === 'manyToMany' || !tableIds.has(roles.parentId) || !tableIds.has(roles.childId)) continue;
    links.push({ relationship, parentId: roles.parentId, childId: roles.childId, parentCardinality: roles.parentCardinality });
  }
  return links;
}

/** Removes FK columns whose relationship no longer exists or no longer has this table as child. */
function removeOrphanedForeignKeys(table: Table, links: readonly ForeignKeyLink[]): Table {
  const ownRelationships = new Set(links.filter((l) => l.childId === table.id).map((l) => l.relationship.id));
  const columns = table.columns.filter((c) => !c.fk || ownRelationships.has(c.fk.relationshipId));
  return columns.length === table.columns.length ? table : { ...table, columns };
}

/**
 * Brings the FK columns of one relationship in line with the parent's primary key.
 * Key columns generated by the relationships in `excluded` are not referenced.
 */
function syncLink(tables: TableMap, link: ForeignKeyLink, excluded: ReadonlySet<Id>): void {
  const parent = tables.get(link.parentId) as Table;
  const child = tables.get(link.childId) as Table;
  const relId = link.relationship.id;
  const referenced = parent.columns.filter((c) => c.isPrimaryKey && !(c.fk && excluded.has(c.fk.relationshipId)));
  const referencedById = new Map(referenced.map((c) => [c.id, c]));

  const kept: Column[] = [];
  const existing = new Set<Id>();
  for (const column of child.columns) {
    if (column.fk?.relationshipId !== relId) {
      kept.push(column);
      continue;
    }
    const target = referencedById.get(column.fk.referencedId);
    if (!target || existing.has(target.id)) continue;
    existing.add(target.id);
    kept.push(updateForeignKeyColumn(column, target, link));
  }
  const added = referenced.filter((c) => !existing.has(c.id)).map((c) => newForeignKeyColumn(c, link));
  tables.set(child.id, { ...child, columns: [...kept, ...added] });
}

function updateForeignKeyColumn(column: Column, referenced: Column, link: ForeignKeyLink): Column {
  const isIdentifying = link.relationship.isIdentifying;
  return {
    ...column,
    isPrimaryKey: isIdentifying,
    isNotNull: isIdentifying || column.isNotNull,
    dataType: column.fk?.isTypeOverridden ? column.dataType : referenced.dataType,
  };
}

function newForeignKeyColumn(referenced: Column, link: ForeignKeyLink): Column {
  const isIdentifying = link.relationship.isIdentifying;
  return {
    id: newId(),
    // The final name is assigned by nameForeignKeyColumns.
    name: referenced.name,
    dataType: referenced.dataType,
    isPrimaryKey: isIdentifying,
    isNotNull: isIdentifying || link.parentCardinality === 'one',
    isUnique: false,
    isIdentity: false,
    fk: { relationshipId: link.relationship.id, referencedId: referenced.id, isRenamed: false, isTypeOverridden: false },
  };
}
