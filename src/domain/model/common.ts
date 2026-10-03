/** Stable identifier of a model element. References between elements always use ids, never names. */
export type Id = string;

/** Position in diagram coordinates (top left corner of a node). */
export interface Point {
  x: number;
  y: number;
}

/** The four crow's foot symbols at the end of a relationship. */
export type Cardinality = 'zeroOrOne' | 'one' | 'zeroOrMany' | 'oneOrMany';

export const CARDINALITIES: readonly Cardinality[] = ['zeroOrOne', 'one', 'zeroOrMany', 'oneOrMany'];

/** Side of a node rectangle a relationship line docks to. */
export type Side = 'top' | 'right' | 'bottom' | 'left';

/**
 * Manually fixed docking point of a relationship end.
 * `offset` is the relative position along the side (0 = start, 1 = end).
 */
export interface Anchor {
  side: Side;
  offset: number;
}

/**
 * A relationship between two entities (logical) or tables (physical).
 *
 * The ends are stored in drawing direction (`source` = start of the drag, `target` = end).
 * Which end is parent and which is child is derived from the cardinalities by
 * `resolveRoles` (see cardinality.ts), so swapping the direction is a plain swap of
 * `sourceId` and `targetId` while the cardinalities stay at their ends.
 * `sourceId === targetId` is a recursive relationship.
 */
export interface Relationship {
  id: Id;
  sourceId: Id;
  targetId: Id;
  sourceCardinality: Cardinality;
  targetCardinality: Cardinality;
  isIdentifying: boolean;
  /** Manually moved docking points; undefined means chosen automatically. */
  sourceAnchor?: Anchor;
  targetAnchor?: Anchor;
}

/** Free text note on the canvas. */
export interface Note {
  id: Id;
  text: string;
  position: Point;
  width: number;
  height: number;
}

/**
 * Marks an attribute or column that was generated from a relationship.
 * Identifies the generated member by (relationshipId, referencedId), which stays
 * stable while names change.
 */
export interface ForeignKeyOrigin {
  relationshipId: Id;
  /** Id of the referenced primary key attribute/column of the parent. */
  referencedId: Id;
  /** True once the user renamed the member; automatic naming no longer overwrites it. */
  isRenamed: boolean;
}

/** Naming convention for generated names (foreign keys, junction tables). */
export type NamingConvention = 'PascalCase' | 'snake_case';
