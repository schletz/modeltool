import type { Cardinality, Id, Relationship } from '../model/common';
import type { Entity, Generalization, LogicalAttribute, LogicalModel } from '../model/logical';

/** Small builders for logical models in tests. */

export function pk(id: Id, name: string): LogicalAttribute {
  return { id, name, isPrimaryKey: true, isOptional: false };
}

export function attr(id: Id, name: string, isOptional = false): LogicalAttribute {
  return { id, name, isPrimaryKey: false, isOptional };
}

export function entity(id: Id, name: string, attributes: LogicalAttribute[] = []): Entity {
  return { id, name, position: { x: 0, y: 0 }, attributes };
}

export function rel(
  id: Id,
  sourceId: Id,
  targetId: Id,
  options: { source?: Cardinality; target?: Cardinality; identifying?: boolean } = {},
): Relationship {
  return {
    id,
    sourceId,
    targetId,
    sourceCardinality: options.source ?? 'one',
    targetCardinality: options.target ?? 'zeroOrMany',
    isIdentifying: options.identifying ?? false,
  };
}

export function generalization(id: Id, supertypeId: Id, subtypeIds: Id[], isComplete = true): Generalization {
  return { id, supertypeId, subtypeIds, isComplete, position: { x: 0, y: 0 } };
}

export function model(
  entities: Entity[],
  relationships: Relationship[] = [],
  generalizations: Generalization[] = [],
): LogicalModel {
  return { entities, relationships, generalizations, notes: [] };
}

export function entityOf(m: LogicalModel, id: Id): Entity {
  const e = m.entities.find((x) => x.id === id);
  if (!e) throw new Error(`entity ${id} not found`);
  return e;
}

export function attributeNames(m: LogicalModel, entityId: Id): string[] {
  return entityOf(m, entityId).attributes.map((a) => a.name);
}

export function attributeNamed(m: LogicalModel, entityId: Id, name: string): LogicalAttribute {
  const a = entityOf(m, entityId).attributes.find((x) => x.name === name);
  if (!a) throw new Error(`attribute ${name} not found in ${entityId}`);
  return a;
}

/** Returns a copy of the model with one entity replaced by `update(entity)`. */
export function updateEntity(m: LogicalModel, id: Id, update: (e: Entity) => Entity): LogicalModel {
  return { ...m, entities: m.entities.map((e) => (e.id === id ? update(e) : e)) };
}
