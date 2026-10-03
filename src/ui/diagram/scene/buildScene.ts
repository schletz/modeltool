import type { Anchor, Id, Note, Relationship } from '../../../domain/model/common';
import type { ModelDocument, ViewKind } from '../../../domain/model/document';
import type { Entity, Generalization } from '../../../domain/model/logical';
import type { Table } from '../../../domain/model/physical';
import type { Rect } from '../../../domain/routing/geometry';
import { computeRoutes, type EdgeRoute, type RoutingEdge } from '../../../domain/routing/computeRoutes';
import { entitySize, generalizationSize, noteRect, tableSize } from '../geometry/nodeGeometry';

export type SceneNode =
  | { kind: 'entity'; id: Id; rect: Rect; entity: Entity }
  | { kind: 'table'; id: Id; rect: Rect; table: Table }
  | { kind: 'generalization'; id: Id; rect: Rect; generalization: Generalization }
  | { kind: 'note'; id: Id; rect: Rect; note: Note };

export type SceneEdge =
  | { kind: 'relationship'; id: Id; sourceId: Id; targetId: Id; relationship: Relationship }
  | {
      kind: 'generalization';
      id: Id;
      sourceId: Id;
      targetId: Id;
      generalization: Generalization;
      /** Undefined for the line between supertype and circle. */
      subtypeId?: Id;
    };

/** Everything needed to draw one view: node rectangles, edges and their routes. */
export interface Scene {
  nodes: SceneNode[];
  edges: SceneEdge[];
  routes: Map<Id, EdgeRoute>;
}

// Generalization lines run vertically in IE notation: out of the bottom, into the top.
const CIRCLE_TOP: Anchor = { side: 'top', offset: 0.5 };
const CIRCLE_BOTTOM: Anchor = { side: 'bottom', offset: 0.5 };

/** Id of the scene edge between supertype and circle, or circle and subtype. */
export function generalizationEdgeId(generalizationId: Id, subtypeId?: Id): Id {
  return subtypeId === undefined ? `${generalizationId}:super` : `${generalizationId}:sub:${subtypeId}`;
}

/**
 * Builds the scene of a view. `editingNodeId` widens the node that has the inline editor open.
 */
export function buildScene(doc: ModelDocument, view: ViewKind, editingNodeId: Id | null): Scene {
  const nodes: SceneNode[] = [];
  const edges: SceneEdge[] = [];
  const routing: RoutingEdge[] = [];

  if (view === 'logical') {
    const model = doc.logical;
    for (const entity of model.entities) {
      const size = entitySize(model, entity, entity.id === editingNodeId);
      nodes.push({ kind: 'entity', id: entity.id, rect: { ...entity.position, ...size }, entity });
    }
    for (const g of model.generalizations) {
      nodes.push({ kind: 'generalization', id: g.id, rect: { ...g.position, ...generalizationSize }, generalization: g });
      const superId = generalizationEdgeId(g.id);
      edges.push({ kind: 'generalization', id: superId, sourceId: g.supertypeId, targetId: g.id, generalization: g });
      routing.push({ id: superId, sourceId: g.supertypeId, targetId: g.id, sourceAnchor: CIRCLE_BOTTOM, targetAnchor: CIRCLE_TOP });
      for (const subtypeId of g.subtypeIds) {
        const id = generalizationEdgeId(g.id, subtypeId);
        edges.push({ kind: 'generalization', id, sourceId: g.id, targetId: subtypeId, generalization: g, subtypeId });
        routing.push({ id, sourceId: g.id, targetId: subtypeId, sourceAnchor: CIRCLE_BOTTOM, targetAnchor: CIRCLE_TOP });
      }
    }
    addRelationships(model.relationships, edges, routing);
    for (const note of model.notes) nodes.push({ kind: 'note', id: note.id, rect: noteRect(note), note });
  } else {
    const model = doc.physical;
    for (const table of model.tables) {
      const size = tableSize(table, table.id === editingNodeId);
      nodes.push({ kind: 'table', id: table.id, rect: { ...table.position, ...size }, table });
    }
    addRelationships(model.relationships, edges, routing);
    for (const note of model.notes) nodes.push({ kind: 'note', id: note.id, rect: noteRect(note), note });
  }

  // Notes are not obstacles: lines may cross them.
  const routingNodes = nodes.filter((n) => n.kind !== 'note').map((n) => ({ id: n.id, rect: n.rect }));
  const nodeIds = new Set(routingNodes.map((n) => n.id));
  const validRouting = routing.filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));
  return { nodes, edges, routes: computeRoutes(routingNodes, validRouting) };
}

function addRelationships(relationships: Relationship[], edges: SceneEdge[], routing: RoutingEdge[]): void {
  for (const rel of relationships) {
    edges.push({ kind: 'relationship', id: rel.id, sourceId: rel.sourceId, targetId: rel.targetId, relationship: rel });
    const edge: RoutingEdge = { id: rel.id, sourceId: rel.sourceId, targetId: rel.targetId };
    if (rel.sourceAnchor) edge.sourceAnchor = rel.sourceAnchor;
    if (rel.targetAnchor) edge.targetAnchor = rel.targetAnchor;
    routing.push(edge);
  }
}
