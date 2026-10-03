import type { Id, Point } from '../model/common';
import type { Entity, Generalization, LogicalAttribute, LogicalModel } from '../model/logical';
import { newId } from '../ids';
import { insertAfter, moveWithinGroup, patchById } from './memberList';
import { deleteRelationshipsOf } from './relationshipOperations';

/** Adds an empty entity at the given position. */
export function addEntity(model: LogicalModel, position: Point, name = ''): [LogicalModel, Id] {
  const entity: Entity = { id: newId(), name, position, attributes: [] };
  return [{ ...model, entities: [...model.entities, entity] }, entity.id];
}

function mapEntity(model: LogicalModel, entityId: Id, fn: (e: Entity) => Entity): LogicalModel {
  return { ...model, entities: model.entities.map((e) => (e.id === entityId ? fn(e) : e)) };
}

export function renameEntity(model: LogicalModel, entityId: Id, name: string): LogicalModel {
  return mapEntity(model, entityId, (e) => ({ ...e, name }));
}

/** Moves nodes (entities and generalization circles) to new positions. */
export function moveLogicalNodes(model: LogicalModel, positions: ReadonlyMap<Id, Point>): LogicalModel {
  return {
    ...model,
    entities: model.entities.map((e) => {
      const p = positions.get(e.id);
      return p ? { ...e, position: p } : e;
    }),
    generalizations: model.generalizations.map((g) => {
      const p = positions.get(g.id);
      return p ? { ...g, position: p } : g;
    }),
  };
}

/** Inserts a new attribute after `afterId` (null = first position). */
export function addAttribute(
  model: LogicalModel,
  entityId: Id,
  afterId: Id | null,
  init: Partial<Omit<LogicalAttribute, 'id'>> = {},
): [LogicalModel, Id] {
  const attribute: LogicalAttribute = { id: newId(), name: '', isPrimaryKey: false, isOptional: false, ...init };
  return [mapEntity(model, entityId, (e) => ({ ...e, attributes: insertAfter(e.attributes, afterId, attribute) })), attribute.id];
}

/**
 * Updates an attribute. Renaming a generated FK attribute marks it as renamed so the
 * automatic naming keeps the user's role name. PK attributes are never optional.
 */
export function updateAttribute(
  model: LogicalModel,
  entityId: Id,
  attributeId: Id,
  patch: Partial<Pick<LogicalAttribute, 'name' | 'isPrimaryKey' | 'isOptional'>>,
): LogicalModel {
  return mapEntity(model, entityId, (e) => ({
    ...e,
    attributes: e.attributes.map((a) => {
      if (a.id !== attributeId) return a;
      // Generated FK attributes only allow renaming; keys and optionality follow the relationship.
      const allowed = a.fk ? { name: patch.name } : patch;
      const next: LogicalAttribute = { ...a, ...stripUndefined(allowed) };
      if (a.fk && patch.name !== undefined && patch.name !== a.name) next.fk = { ...a.fk, isRenamed: true };
      if (next.isPrimaryKey) next.isOptional = false;
      return next;
    }),
  }));
}

/** Moves an attribute one step up or down within its block (PK / non-PK). */
export function moveAttribute(model: LogicalModel, entityId: Id, attributeId: Id, direction: -1 | 1): LogicalModel {
  return mapEntity(model, entityId, (e) => ({
    ...e,
    attributes: moveWithinGroup(e.attributes, attributeId, direction, (a, b) => a.isPrimaryKey === b.isPrimaryKey),
  }));
}

/** Deletes an attribute. Generated FK attributes cannot be deleted (only via their relationship). */
export function deleteAttribute(model: LogicalModel, entityId: Id, attributeId: Id): LogicalModel {
  return mapEntity(model, entityId, (e) => ({
    ...e,
    attributes: e.attributes.filter((a) => a.id !== attributeId || a.fk !== undefined),
  }));
}

/** Deletes an entity with all its relationships and its generalization memberships. */
export function deleteEntity(model: LogicalModel, entityId: Id): LogicalModel {
  const withoutRels = deleteRelationshipsOf(model, entityId);
  return {
    ...withoutRels,
    entities: withoutRels.entities.filter((e) => e.id !== entityId),
    generalizations: withoutRels.generalizations
      .filter((g) => g.supertypeId !== entityId)
      .map((g) => ({ ...g, subtypeIds: g.subtypeIds.filter((s) => s !== entityId) }))
      .filter((g) => g.subtypeIds.length > 0),
  };
}

export type GeneralizationError = 'self' | 'subtypeIsSupertype' | 'alreadySubtype' | 'supertypeIsSubtype';

/**
 * Adds `subtypeId` as subtype of `supertypeId`, creating the generalization if needed.
 * Enforces the one level rule: a subtype cannot be a supertype and belongs to one generalization only.
 */
export function addSubtype(
  model: LogicalModel,
  supertypeId: Id,
  subtypeId: Id,
): { ok: true; model: LogicalModel; generalizationId: Id } | { ok: false; error: GeneralizationError } {
  if (supertypeId === subtypeId) return { ok: false, error: 'self' };
  const gens = model.generalizations;
  if (gens.some((g) => g.subtypeIds.includes(subtypeId))) return { ok: false, error: 'alreadySubtype' };
  if (gens.some((g) => g.supertypeId === subtypeId)) return { ok: false, error: 'subtypeIsSupertype' };
  if (gens.some((g) => g.subtypeIds.includes(supertypeId))) return { ok: false, error: 'supertypeIsSubtype' };

  // Subtypes inherit the supertype's key, so own PK flags are dropped.
  const clearedKeys = mapEntity(model, subtypeId, (e) => ({
    ...e,
    attributes: e.attributes.map((a) => (a.isPrimaryKey && !a.fk ? { ...a, isPrimaryKey: false } : a)),
  }));
  const existing = gens.find((g) => g.supertypeId === supertypeId);
  if (existing) {
    return {
      ok: true,
      generalizationId: existing.id,
      model: {
        ...clearedKeys,
        generalizations: gens.map((g) => (g.id === existing.id ? { ...g, subtypeIds: [...g.subtypeIds, subtypeId] } : g)),
      },
    };
  }
  const supertype = model.entities.find((e) => e.id === supertypeId);
  const subtype = model.entities.find((e) => e.id === subtypeId);
  const generalization: Generalization = {
    id: newId(),
    supertypeId,
    subtypeIds: [subtypeId],
    isComplete: true,
    position: circlePosition(supertype?.position, subtype?.position),
  };
  return {
    ok: true,
    generalizationId: generalization.id,
    model: { ...clearedKeys, generalizations: [...gens, generalization] },
  };
}

/** Places the category circle between supertype and first subtype. */
function circlePosition(supertype: Point | undefined, subtype: Point | undefined): Point {
  if (!supertype || !subtype) return supertype ?? subtype ?? { x: 0, y: 0 };
  return { x: Math.round((supertype.x + subtype.x) / 2 + 60), y: Math.round((supertype.y + subtype.y) / 2 + 40) };
}

export function updateGeneralization(
  model: LogicalModel,
  id: Id,
  patch: Partial<Pick<Generalization, 'isComplete' | 'strategy'>>,
): LogicalModel {
  return { ...model, generalizations: patchById(model.generalizations, id, patch) };
}

/** Removes one subtype; a generalization without subtypes is deleted. */
export function removeSubtype(model: LogicalModel, generalizationId: Id, subtypeId: Id): LogicalModel {
  return {
    ...model,
    generalizations: model.generalizations
      .map((g) => (g.id === generalizationId ? { ...g, subtypeIds: g.subtypeIds.filter((s) => s !== subtypeId) } : g))
      .filter((g) => g.subtypeIds.length > 0),
  };
}

export function deleteGeneralization(model: LogicalModel, id: Id): LogicalModel {
  return { ...model, generalizations: model.generalizations.filter((g) => g.id !== id) };
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}
