import type { Anchor, Cardinality, Id, Relationship } from '../model/common';
import { newId } from '../ids';

/** Any model that holds relationships (logical or physical). */
export interface WithRelationships {
  relationships: Relationship[];
}

/**
 * Adds a relationship drawn from `sourceId` to `targetId` with the defaults of spec 3.3:
 * parent end 1, child end 0..n, non identifying. The start entity is the parent.
 */
export function addRelationship<M extends WithRelationships>(model: M, sourceId: Id, targetId: Id): [M, Id] {
  const rel: Relationship = {
    id: newId(),
    sourceId,
    targetId,
    sourceCardinality: 'one',
    targetCardinality: 'zeroOrMany',
    isIdentifying: false,
  };
  return [{ ...model, relationships: [...model.relationships, rel] }, rel.id];
}

/** Applies a partial update to one relationship. */
export function updateRelationship<M extends WithRelationships>(
  model: M,
  id: Id,
  patch: Partial<Omit<Relationship, 'id'>>,
): M {
  return {
    ...model,
    relationships: model.relationships.map((r) => (r.id === id ? { ...r, ...patch } : r)),
  };
}

/** Sets the symbol at one end of a relationship. */
export function setCardinality<M extends WithRelationships>(
  model: M,
  id: Id,
  end: 'source' | 'target',
  cardinality: Cardinality,
): M {
  return updateRelationship(model, id, end === 'source' ? { sourceCardinality: cardinality } : { targetCardinality: cardinality });
}

/**
 * Swaps the drawing direction. The cardinalities stay at their ends, so the former
 * child becomes the parent (and for symmetric 1:1 the FK moves to the other side).
 */
export function swapDirection<M extends WithRelationships>(model: M, id: Id): M {
  return {
    ...model,
    relationships: model.relationships.map((r) => {
      if (r.id !== id) return r;
      const swapped: Relationship = {
        ...r,
        sourceId: r.targetId,
        targetId: r.sourceId,
        sourceAnchor: r.targetAnchor,
        targetAnchor: r.sourceAnchor,
      };
      if (!swapped.sourceAnchor) delete swapped.sourceAnchor;
      if (!swapped.targetAnchor) delete swapped.targetAnchor;
      return swapped;
    }),
  };
}

/** Fixes the docking point of one end; `undefined` returns it to automatic placement. */
export function setAnchor<M extends WithRelationships>(model: M, id: Id, end: 'source' | 'target', anchor: Anchor | undefined): M {
  const key = end === 'source' ? 'sourceAnchor' : 'targetAnchor';
  return {
    ...model,
    relationships: model.relationships.map((r) => {
      if (r.id !== id) return r;
      const next: Relationship = { ...r, [key]: anchor };
      if (anchor === undefined) delete next[key];
      return next;
    }),
  };
}

/** Removes the manually fixed docking points of a relationship. */
export function resetAnchors<M extends WithRelationships>(model: M, id: Id): M {
  return {
    ...model,
    relationships: model.relationships.map((r) => {
      if (r.id !== id) return r;
      const { sourceAnchor: _s, targetAnchor: _t, ...rest } = r;
      return rest;
    }),
  };
}

/** Deletes a relationship; generated FKs disappear with the next FK synchronization. */
export function deleteRelationship<M extends WithRelationships>(model: M, id: Id): M {
  return { ...model, relationships: model.relationships.filter((r) => r.id !== id) };
}

/** Deletes all relationships touching the given node. */
export function deleteRelationshipsOf<M extends WithRelationships>(model: M, nodeId: Id): M {
  return {
    ...model,
    relationships: model.relationships.filter((r) => r.sourceId !== nodeId && r.targetId !== nodeId),
  };
}
