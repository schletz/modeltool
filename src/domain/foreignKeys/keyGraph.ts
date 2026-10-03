import { resolveRoles } from '../cardinality';
import type { Id } from '../model/common';
import type { LogicalModel } from '../model/logical';

/**
 * Maps each subtype to its supertype. Invalid generalization members are ignored so that
 * the result always describes a one level hierarchy: an entity that is a supertype itself,
 * the supertype as its own subtype, missing entities and second memberships are skipped.
 */
export function supertypeBySubtype(model: LogicalModel): Map<Id, Id> {
  const entityIds = new Set(model.entities.map((e) => e.id));
  const supertypeIds = new Set(model.generalizations.map((g) => g.supertypeId));
  const result = new Map<Id, Id>();
  for (const gen of model.generalizations) {
    if (!entityIds.has(gen.supertypeId)) continue;
    for (const subId of gen.subtypeIds) {
      if (subId === gen.supertypeId || supertypeIds.has(subId) || result.has(subId) || !entityIds.has(subId)) continue;
      result.set(subId, gen.supertypeId);
    }
  }
  return result;
}

/** A cycle of key dependencies: one strongly connected component of the key graph. */
export interface KeyCycle {
  /** Entities of the cycle in model order. */
  entityIds: Id[];
  /** Identifying relationships within the cycle in model order (never empty). */
  relationshipIds: Id[];
}

/**
 * Key dependencies of the logical model. An entity's primary key depends on the parents of
 * its identifying relationships and, for a subtype, on its supertype.
 */
export interface KeyGraph {
  /** All entity ids, key providers before key receivers (ties keep the model order). */
  order: Id[];
  /** Identifying relationships lying on a cycle (self-loops included). */
  cyclicRelationshipIds: Set<Id>;
  cycles: KeyCycle[];
}

interface Edge {
  from: Id;
  to: Id;
  /** Undefined for supertype -> subtype edges. */
  relationshipId?: Id;
}

/**
 * Builds the key dependency graph from identifying relationships (parent -> child) and
 * generalizations (supertype -> subtype), finds its cycles and a processing order that
 * ignores the identifying relationships on cycles.
 */
export function analyzeKeyGraph(model: LogicalModel, supertypeOf: ReadonlyMap<Id, Id>): KeyGraph {
  const entityIds = model.entities.map((e) => e.id);
  const known = new Set(entityIds);
  const edges: Edge[] = [];
  for (const rel of model.relationships) {
    if (!rel.isIdentifying) continue;
    const roles = resolveRoles(rel);
    if (roles.kind === 'manyToMany' || !known.has(roles.parentId) || !known.has(roles.childId)) continue;
    edges.push({ from: roles.parentId, to: roles.childId, relationshipId: rel.id });
  }
  for (const [subId, superId] of supertypeOf) edges.push({ from: superId, to: subId });

  const component = stronglyConnectedComponents(entityIds, edges);
  const cyclicEdges = edges.filter((e) => e.relationshipId !== undefined && component.get(e.from) === component.get(e.to));
  const cyclicRelationshipIds = new Set(cyclicEdges.map((e) => e.relationshipId as Id));

  // Every cycle contains an identifying relationship (generalizations are one level only),
  // so the components holding a cyclic relationship are exactly the cycles.
  const componentOfRelationship = new Map(cyclicEdges.map((e) => [e.relationshipId as Id, component.get(e.from)]));
  const cyclicComponents = new Set(componentOfRelationship.values());
  const cycles: KeyCycle[] = [...cyclicComponents].map((c) => ({
    entityIds: entityIds.filter((id) => component.get(id) === c),
    relationshipIds: model.relationships.filter((r) => componentOfRelationship.get(r.id) === c).map((r) => r.id),
  }));

  const acyclicEdges = edges.filter((e) => e.relationshipId === undefined || !cyclicRelationshipIds.has(e.relationshipId));
  return { order: topologicalOrder(entityIds, acyclicEdges), cyclicRelationshipIds, cycles };
}

/** Tarjan's algorithm; returns the component index of every node. */
function stronglyConnectedComponents(nodes: readonly Id[], edges: readonly Edge[]): Map<Id, number> {
  const successors = adjacency(nodes, edges);
  const index = new Map<Id, number>();
  const lowLink = new Map<Id, number>();
  const onStack = new Set<Id>();
  const stack: Id[] = [];
  const component = new Map<Id, number>();
  let counter = 0;
  let componentCount = 0;

  const visit = (v: Id): void => {
    index.set(v, counter);
    lowLink.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    for (const w of successors.get(v) ?? []) {
      if (!index.has(w)) {
        visit(w);
        lowLink.set(v, Math.min(lowLink.get(v) as number, lowLink.get(w) as number));
      } else if (onStack.has(w)) {
        lowLink.set(v, Math.min(lowLink.get(v) as number, index.get(w) as number));
      }
    }
    if (lowLink.get(v) === index.get(v)) {
      let w: Id;
      do {
        w = stack.pop() as Id;
        onStack.delete(w);
        component.set(w, componentCount);
      } while (w !== v);
      componentCount++;
    }
  };

  for (const v of nodes) if (!index.has(v)) visit(v);
  return component;
}

/** Kahn's algorithm on an acyclic graph; among ready nodes the one first in `nodes` wins. */
function topologicalOrder(nodes: readonly Id[], edges: readonly Edge[]): Id[] {
  const successors = adjacency(nodes, edges);
  const inDegree = new Map<Id, number>(nodes.map((n) => [n, 0]));
  for (const e of edges) inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  const position = new Map<Id, number>(nodes.map((n, i) => [n, i]));

  const ready = nodes.filter((n) => inDegree.get(n) === 0);
  const order: Id[] = [];
  while (ready.length > 0) {
    ready.sort((a, b) => (position.get(a) as number) - (position.get(b) as number));
    const next = ready.shift() as Id;
    order.push(next);
    for (const s of successors.get(next) ?? []) {
      const degree = (inDegree.get(s) as number) - 1;
      inDegree.set(s, degree);
      if (degree === 0) ready.push(s);
    }
  }
  return order;
}

function adjacency(nodes: readonly Id[], edges: readonly Edge[]): Map<Id, Id[]> {
  const result = new Map<Id, Id[]>(nodes.map((n) => [n, []]));
  for (const e of edges) result.get(e.from)?.push(e.to);
  return result;
}
