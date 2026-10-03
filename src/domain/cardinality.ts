import { CARDINALITIES, type Cardinality, type Id, type Relationship } from './model/common';

/** True if the maximum of the cardinality is n. */
export function isMany(c: Cardinality): boolean {
  return c === 'zeroOrMany' || c === 'oneOrMany';
}

/** True if the minimum of the cardinality is 0. */
export function isOptionalEnd(c: Cardinality): boolean {
  return c === 'zeroOrOne' || c === 'zeroOrMany';
}

/** Next symbol in the cycle used when clicking a line end. */
export function nextCardinality(c: Cardinality): Cardinality {
  const index = CARDINALITIES.indexOf(c);
  return CARDINALITIES[(index + 1) % CARDINALITIES.length] as Cardinality;
}

export type RelationshipKind = 'oneToMany' | 'oneToOne' | 'manyToMany';

/** Parent/child view of a relationship, derived from drawing direction and cardinalities. */
export type RelationshipRoles =
  | {
      kind: 'oneToMany' | 'oneToOne';
      parentId: Id;
      childId: Id;
      /** Symbol at the parent's end, decides whether the FK is mandatory ('one') or optional. */
      parentCardinality: Cardinality;
      childCardinality: Cardinality;
      /** True if the parent is the target of the drawn line (roles are reversed). */
      isReversed: boolean;
    }
  | { kind: 'manyToMany' };

/**
 * Derives which end is parent and which is child:
 * - 1:n: the parent is the end with maximum 1, the child (FK holder) is the "many" end.
 * - 1:1 with `1 : 0..1`: the child is the end whose symbol is 0..1.
 * - symmetric 1:1: the drawing direction decides (child = target).
 * - n:m: no parent/child, FKs are only created by the transformation.
 */
export function resolveRoles(rel: Relationship): RelationshipRoles {
  const s = rel.sourceCardinality;
  const t = rel.targetCardinality;
  if (isMany(s) && isMany(t)) return { kind: 'manyToMany' };

  let reversed: boolean;
  if (isMany(s) !== isMany(t)) {
    reversed = isMany(s);
  } else if (s !== t) {
    // 1:1 with exactly one 0..1 end: the child is the 0..1 end.
    reversed = s === 'zeroOrOne';
  } else {
    reversed = false;
  }
  return {
    kind: isMany(s) || isMany(t) ? 'oneToMany' : 'oneToOne',
    parentId: reversed ? rel.targetId : rel.sourceId,
    childId: reversed ? rel.sourceId : rel.targetId,
    parentCardinality: reversed ? t : s,
    childCardinality: reversed ? s : t,
    isReversed: reversed,
  };
}
