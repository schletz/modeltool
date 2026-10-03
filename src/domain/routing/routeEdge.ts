import type { Point } from '../model/common';
import { sideNormal, type Port, type Rect } from './geometry';
import { buildOrthogonalGrid } from './orthogonalGrid';
import { directionOf, searchOrthogonalPath } from './orthogonalPathSearch';
import { STUB_LENGTH } from './routingConstants';
import { simplifyPath } from './simplifyPath';

/**
 * Routes one edge between two docking points.
 *
 * The line leaves the source and enters the target perpendicular to the border with a stub of
 * at least {@link STUB_LENGTH}; the part between the stub ends is searched on an orthogonal grid.
 * The obstacle sets are tried in order (e.g. with margin, then without) and a plain Z path is the
 * last resort when every search fails.
 *
 * @returns the simplified polyline from source.point to target.point.
 */
export function routeEdge(source: Port, target: Port, obstacleSets: readonly (readonly Rect[])[]): Point[] {
  const sourceNormal = sideNormal(source.side);
  const targetNormal = sideNormal(target.side);
  const start = { x: source.point.x + sourceNormal.x * STUB_LENGTH, y: source.point.y + sourceNormal.y * STUB_LENGTH };
  const goal = { x: target.point.x + targetNormal.x * STUB_LENGTH, y: target.point.y + targetNormal.y * STUB_LENGTH };
  const startDir = directionOf(sourceNormal);
  // Arriving at the target stub means travelling against the target's outward normal.
  const goalDir = directionOf({ x: -targetNormal.x, y: -targetNormal.y });

  let middle: Point[] | null = null;
  for (const obstacles of obstacleSets) {
    middle = searchOrthogonalPath(buildOrthogonalGrid(start, goal, obstacles), start, startDir, goal, goalDir);
    if (middle) break;
  }
  return simplifyPath([source.point, ...(middle ?? fallbackPath(start, sourceNormal, goal)), target.point]);
}

/** Z shaped path between the stub ends that never turns back into the source stub. */
function fallbackPath(start: Point, startNormal: Point, goal: Point): Point[] {
  if (startNormal.x !== 0) {
    const midX = startNormal.x > 0 ? Math.max(start.x, (start.x + goal.x) / 2) : Math.min(start.x, (start.x + goal.x) / 2);
    return [start, { x: midX, y: start.y }, { x: midX, y: goal.y }, goal];
  }
  const midY = startNormal.y > 0 ? Math.max(start.y, (start.y + goal.y) / 2) : Math.min(start.y, (start.y + goal.y) / 2);
  return [start, { x: start.x, y: midY }, { x: goal.x, y: midY }, goal];
}
