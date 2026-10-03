import type { Id, Point, Relationship } from '../model/common';
import type { Entity, Generalization, LogicalAttribute, LogicalModel } from '../model/logical';

/** Attribute for tests; the id is filled by `entity` as "<Entity>.<Attribute>". */
export function attr(name: string, props: Partial<LogicalAttribute> = {}): LogicalAttribute {
  return { id: '', name, isPrimaryKey: false, isOptional: false, ...props };
}

/** Primary key attribute for tests. */
export function pkAttr(name: string): LogicalAttribute {
  return attr(name, { isPrimaryKey: true });
}

/** Generated FK attribute for tests (as produced by the logical FK sync). */
export function fkAttr(
  name: string,
  relationshipId: Id,
  referencedId: Id,
  props: Partial<LogicalAttribute> & { isRenamed?: boolean } = {},
): LogicalAttribute {
  const { isRenamed = false, ...rest } = props;
  return attr(name, { fk: { relationshipId, referencedId, isRenamed }, ...rest });
}

/** Entity for tests with id = name. */
export function entity(name: string, attributes: LogicalAttribute[], position: Point = { x: 0, y: 0 }): Entity {
  return {
    id: name,
    name,
    position,
    attributes: attributes.map((a) => (a.id === '' ? { ...a, id: `${name}.${a.name}` } : a)),
  };
}

/** Generalization for tests, complete by default. */
export function generalization(id: Id, supertypeId: Id, subtypeIds: Id[], isComplete = true): Generalization {
  return { id, supertypeId, subtypeIds, isComplete, position: { x: 0, y: 0 } };
}

/** Logical model for tests without notes. */
export function logical(
  entities: Entity[],
  relationships: Relationship[] = [],
  generalizations: Generalization[] = [],
): LogicalModel {
  return { entities, relationships, generalizations, notes: [] };
}
