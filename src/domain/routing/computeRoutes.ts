import type { Anchor, Id, Point } from '../model/common';
import { assignPorts } from './assignPorts';
import { expandRect, type Port, type Rect } from './geometry';
import { routeEdge } from './routeEdge';
import { OBSTACLE_MARGIN } from './routingConstants';
import { separateOverlaps } from './separateOverlaps';

export { STUB_LENGTH } from './routingConstants';
export { anchorFromPoint, portFromAnchor } from './anchors';

export interface RoutingNode {
  id: Id;
  rect: Rect;
}

export interface RoutingEdge {
  id: Id;
  sourceId: Id;
  targetId: Id;
  sourceAnchor?: Anchor;
  targetAnchor?: Anchor;
}

export interface EdgeRoute {
  source: Port;
  target: Port;
  /** Orthogonal polyline from source.point to target.point (inclusive). */
  points: Point[];
}

/**
 * Computes docking points and orthogonal routes for all edges of a diagram (spec 8.2).
 *
 * 1. Docking points: manual anchors are honoured, all other ends are placed automatically
 *    (see {@link assignPorts}).
 * 2. Every edge is routed on its own around all nodes, keeping {@link OBSTACLE_MARGIN} distance
 *    where possible (see {@link routeEdge}).
 * 3. Overlapping segments of different edges are moved into separate lanes.
 *
 * Edges that reference an unknown node get no route.
 */
export function computeRoutes(nodes: readonly RoutingNode[], edges: readonly RoutingEdge[]): Map<Id, EdgeRoute> {
  const rects = new Map(nodes.map((node) => [node.id, node.rect] as const));
  const ports = assignPorts(rects, edges);
  const obstacles = nodes.map((node) => node.rect);
  const obstacleSets = [obstacles.map((rect) => expandRect(rect, OBSTACLE_MARGIN)), obstacles];

  const routes = new Map<Id, EdgeRoute>();
  for (const edge of edges) {
    const pair = ports.get(edge.id);
    if (!pair) continue;
    routes.set(edge.id, { ...pair, points: routeEdge(pair.source, pair.target, obstacleSets) });
  }
  separateOverlaps(
    [...routes.values()].map((route) => route.points),
    obstacles,
  );
  return routes;
}
