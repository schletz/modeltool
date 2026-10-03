import { describe, expect, it } from 'vitest';
import type { Point } from '../model/common';
import { computeRoutes, STUB_LENGTH, type EdgeRoute, type RoutingEdge, type RoutingNode } from './computeRoutes';
import { expandRect, sideNormal, type Rect } from './geometry';
import { OBSTACLE_MARGIN } from './routingConstants';

const node = (id: string, x: number, y: number, width = 120, height = 80): RoutingNode => ({ id, rect: { x, y, width, height } });
const edge = (id: string, sourceId: string, targetId: string, extra: Partial<RoutingEdge> = {}): RoutingEdge => ({
  id,
  sourceId,
  targetId,
  ...extra,
});

function routeOf(routes: Map<string, EdgeRoute>, id: string): EdgeRoute {
  const route = routes.get(id);
  if (!route) throw new Error(`no route for ${id}`);
  return route;
}

function segments(points: readonly Point[]): [Point, Point][] {
  return points.slice(1).map((p, i) => [points[i]!, p]);
}

/** True if the axis-parallel segment passes through the open interior of the rect. */
function crossesInterior([a, b]: [Point, Point], r: Rect): boolean {
  const eps = 1e-6;
  return (
    Math.min(a.x, b.x) < r.x + r.width - eps &&
    Math.max(a.x, b.x) > r.x + eps &&
    Math.min(a.y, b.y) < r.y + r.height - eps &&
    Math.max(a.y, b.y) > r.y + eps
  );
}

/** Checks all structural guarantees of a route. */
function expectWellFormed(route: EdgeRoute): void {
  const { points, source, target } = route;
  expect(points.length).toBeGreaterThanOrEqual(2);
  expect(points[0]).toEqual(source.point);
  expect(points[points.length - 1]).toEqual(target.point);
  for (const [a, b] of segments(points)) {
    expect(a.x === b.x || a.y === b.y, `segment ${JSON.stringify([a, b])} is not axis-parallel`).toBe(true);
    expect(a.x === b.x && a.y === b.y, 'zero-length segment').toBe(false);
  }

  const [s0, s1] = [points[0]!, points[1]!];
  const outSource = sideNormal(source.side);
  const firstLength = Math.abs(s1.x - s0.x) + Math.abs(s1.y - s0.y);
  expect(Math.sign(s1.x - s0.x)).toBe(outSource.x);
  expect(Math.sign(s1.y - s0.y)).toBe(outSource.y);
  expect(firstLength).toBeGreaterThanOrEqual(STUB_LENGTH);

  const [t0, t1] = [points[points.length - 1]!, points[points.length - 2]!];
  const outTarget = sideNormal(target.side);
  const lastLength = Math.abs(t1.x - t0.x) + Math.abs(t1.y - t0.y);
  expect(Math.sign(t1.x - t0.x)).toBe(outTarget.x);
  expect(Math.sign(t1.y - t0.y)).toBe(outTarget.y);
  expect(lastLength).toBeGreaterThanOrEqual(STUB_LENGTH);
}

function expectNoObstacleCrossing(route: EdgeRoute, nodes: readonly RoutingNode[]): void {
  for (const segment of segments(route.points)) {
    for (const n of nodes) expect(crossesInterior(segment, n.rect), `segment crosses ${n.id}`).toBe(false);
  }
}

/** True if two routes share a piece of collinear line of positive length. */
function overlaps(a: EdgeRoute, b: EdgeRoute): boolean {
  for (const [p, q] of segments(a.points)) {
    for (const [r, s] of segments(b.points)) {
      if (p.x === q.x && r.x === s.x && p.x === r.x) {
        if (Math.min(Math.max(p.y, q.y), Math.max(r.y, s.y)) - Math.max(Math.min(p.y, q.y), Math.min(r.y, s.y)) > 1e-6) return true;
      }
      if (p.y === q.y && r.y === s.y && p.y === r.y) {
        if (Math.min(Math.max(p.x, q.x), Math.max(r.x, s.x)) - Math.max(Math.min(p.x, q.x), Math.min(r.x, s.x)) > 1e-6) return true;
      }
    }
  }
  return false;
}

describe('computeRoutes', () => {
  it('connects horizontally separated nodes via facing left/right sides', () => {
    const nodes = [node('a', 0, 0), node('b', 400, 150)];
    const route = routeOf(computeRoutes(nodes, [edge('e', 'a', 'b')]), 'e');
    expect(route.source.side).toBe('right');
    expect(route.target.side).toBe('left');
    expect(route.source.point).toEqual({ x: 120, y: 40 });
    expect(route.target.point).toEqual({ x: 400, y: 190 });
    expectWellFormed(route);
    expectNoObstacleCrossing(route, nodes);
  });

  it('connects vertically separated nodes via facing top/bottom sides', () => {
    const nodes = [node('a', 0, 400), node('b', 60, 0)];
    const route = routeOf(computeRoutes(nodes, [edge('e', 'a', 'b')]), 'e');
    expect(route.source.side).toBe('top');
    expect(route.target.side).toBe('bottom');
    expectWellFormed(route);
  });

  it('docks both ends on the same side when the nodes are too close for facing stubs', () => {
    const nodes = [node('a', 0, 0), node('b', 140, 10)];
    const route = routeOf(computeRoutes(nodes, [edge('e', 'a', 'b')]), 'e');
    expect(route.source.side).toBe('top');
    expect(route.target.side).toBe('top');
    expectWellFormed(route);
    expectNoObstacleCrossing(route, nodes);
  });

  it('routes around a blocking node with the obstacle margin', () => {
    const blocker = node('c', 220, -60, 120, 200);
    const nodes = [node('a', 0, 0), blocker, node('b', 520, 0)];
    const route = routeOf(computeRoutes(nodes, [edge('e', 'a', 'b')]), 'e');
    expectWellFormed(route);
    expectNoObstacleCrossing(route, nodes);
    const withMargin = expandRect(blocker.rect, OBSTACLE_MARGIN - 1e-3);
    for (const segment of segments(route.points)) expect(crossesInterior(segment, withMargin)).toBe(false);
    // A straight line would have been shorter, so the route must have detoured.
    expect(route.points.length).toBeGreaterThan(2);
  });

  it('honours manual anchors exactly', () => {
    const nodes = [node('a', 0, 0, 200, 100), node('b', 500, 300, 100, 100)];
    const routes = computeRoutes(nodes, [
      edge('e', 'a', 'b', { sourceAnchor: { side: 'bottom', offset: 0.25 }, targetAnchor: { side: 'top', offset: 0.8 } }),
    ]);
    const route = routeOf(routes, 'e');
    expect(route.source).toEqual({ side: 'bottom', point: { x: 50, y: 100 } });
    expect(route.target).toEqual({ side: 'top', point: { x: 580, y: 300 } });
    expectWellFormed(route);
    expectNoObstacleCrossing(route, nodes);
  });

  it('distributes several automatic ends on one side evenly, ordered by the opposite end', () => {
    const nodes = [node('hub', 0, 200, 120, 120), node('low', 400, 500), node('high', 400, -100), node('mid', 400, 220)];
    const routes = computeRoutes(nodes, [edge('e1', 'hub', 'low'), edge('e2', 'hub', 'high'), edge('e3', 'mid', 'hub')]);
    const high = routeOf(routes, 'e2');
    const mid = routeOf(routes, 'e3');
    const low = routeOf(routes, 'e1');
    expect(high.source).toEqual({ side: 'right', point: { x: 120, y: 230 } });
    expect(mid.target).toEqual({ side: 'right', point: { x: 120, y: 260 } });
    expect(low.source).toEqual({ side: 'right', point: { x: 120, y: 290 } });
    for (const route of [high, mid, low]) {
      expectWellFormed(route);
      expectNoObstacleCrossing(route, nodes);
    }
  });

  it('draws a recursive edge as a loop around the top right corner', () => {
    const nodes = [node('a', 100, 100, 160, 100)];
    const route = routeOf(computeRoutes(nodes, [edge('self', 'a', 'a')]), 'self');
    expect(route.source.side).toBe('right');
    expect(route.target.side).toBe('top');
    expectWellFormed(route);
    expectNoObstacleCrossing(route, nodes);
    expect(route.points.some((p) => p.x > 260 && p.y < 100)).toBe(true);
  });

  it('keeps parallel edges between the same nodes apart', () => {
    const nodes = [node('a', 0, 0), node('b', 400, 200)];
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'a', 'b'), edge('e3', 'b', 'a')];
    const routes = computeRoutes(nodes, edges);
    const all = edges.map((e) => routeOf(routes, e.id));
    for (const route of all) {
      expectWellFormed(route);
      expectNoObstacleCrossing(route, nodes);
    }
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) expect(overlaps(all[i]!, all[j]!), `routes ${i} and ${j} overlap`).toBe(false);
    }
  });

  it('nests parallel recursive loops without overlap', () => {
    const nodes = [node('a', 0, 0, 160, 120)];
    const routes = computeRoutes(nodes, [edge('l1', 'a', 'a'), edge('l2', 'a', 'a')]);
    const [l1, l2] = [routeOf(routes, 'l1'), routeOf(routes, 'l2')];
    expectWellFormed(l1);
    expectWellFormed(l2);
    expect(overlaps(l1, l2)).toBe(false);
  });

  it('skips edges that reference unknown nodes', () => {
    const routes = computeRoutes([node('a', 0, 0)], [edge('e', 'a', 'missing')]);
    expect(routes.size).toBe(0);
  });

  it('routes 50 nodes and 80 edges well within the drag budget', () => {
    const nodes: RoutingNode[] = [];
    for (let i = 0; i < 50; i++) nodes.push(node(`n${i}`, (i % 10) * 220, Math.floor(i / 10) * 180, 140, 90 + (i % 3) * 20));
    // Deterministic pseudo random edges (linear congruential generator).
    let seed = 42;
    const random = (n: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const edges: RoutingEdge[] = [];
    for (let i = 0; i < 80; i++) edges.push(edge(`e${i}`, `n${random(50)}`, `n${random(50)}`));

    computeRoutes(nodes, edges); // warm-up for the JIT
    const started = performance.now();
    const routes = computeRoutes(nodes, edges);
    const elapsed = performance.now() - started;

    expect(routes.size).toBe(80);
    for (const route of routes.values()) {
      expectWellFormed(route);
      expectNoObstacleCrossing(route, nodes);
    }
    expect(elapsed).toBeLessThan(100);
  });
});
