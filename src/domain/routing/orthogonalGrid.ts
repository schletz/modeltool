import type { Point } from '../model/common';
import { EPSILON, expandRect, rectsTouch, unionRect, type Rect } from './geometry';
import { OBSTACLE_MARGIN } from './routingConstants';

/**
 * Sparse orthogonal visibility grid. Grid lines are the obstacle borders, the start and goal
 * coordinates and an outer ring around everything; node (ix, iy) lies at (xs[ix], ys[iy]).
 * Flat arrays are indexed by `ix + iy * xs.length`.
 */
export interface OrthogonalGrid {
  readonly xs: readonly number[];
  readonly ys: readonly number[];
  /** 1 if the node lies strictly inside an obstacle. */
  readonly blockedNode: Uint8Array;
  /** 1 if the segment from (ix, iy) to (ix + 1, iy) runs through an obstacle. */
  readonly blockedRight: Uint8Array;
  /** 1 if the segment from (ix, iy) to (ix, iy + 1) runs through an obstacle. */
  readonly blockedDown: Uint8Array;
}

/**
 * Builds the grid for one connection. Only obstacles in the neighbourhood of start and goal are
 * considered: the region grows until its surrounding ring touches no further obstacle, so the
 * ring is always a free detour and obstacles outside it cannot be hit.
 */
export function buildOrthogonalGrid(start: Point, goal: Point, obstacles: readonly Rect[]): OrthogonalGrid {
  const { relevant, ring } = collectRelevantObstacles(start, goal, obstacles);
  const xs = uniqueSorted([ring.x, ring.x + ring.width, start.x, goal.x, ...relevant.flatMap((o) => [o.x, o.x + o.width])]);
  const ys = uniqueSorted([ring.y, ring.y + ring.height, start.y, goal.y, ...relevant.flatMap((o) => [o.y, o.y + o.height])]);
  const nx = xs.length;
  const size = nx * ys.length;
  const blockedNode = new Uint8Array(size);
  const blockedRight = new Uint8Array(size);
  const blockedDown = new Uint8Array(size);

  for (const o of relevant) {
    // Obstacle borders are grid lines, so each grid segment lies either completely inside or outside.
    const x0 = indexOfCoordinate(xs, o.x);
    const x1 = indexOfCoordinate(xs, o.x + o.width);
    const y0 = indexOfCoordinate(ys, o.y);
    const y1 = indexOfCoordinate(ys, o.y + o.height);
    for (let iy = y0; iy <= y1; iy++) {
      const insideY = iy > y0 && iy < y1;
      for (let ix = x0; ix <= x1; ix++) {
        const insideX = ix > x0 && ix < x1;
        const k = ix + iy * nx;
        if (insideX && insideY) blockedNode[k] = 1;
        if (insideY && ix < x1) blockedRight[k] = 1;
        if (insideX && iy < y1) blockedDown[k] = 1;
      }
    }
  }
  return { xs, ys, blockedNode, blockedRight, blockedDown };
}

/** Flat index of the grid node at `point`, which must lie on grid lines. */
export function gridNodeAt(grid: OrthogonalGrid, point: Point): number {
  return indexOfCoordinate(grid.xs, point.x) + indexOfCoordinate(grid.ys, point.y) * grid.xs.length;
}

function collectRelevantObstacles(start: Point, goal: Point, obstacles: readonly Rect[]): { relevant: Rect[]; ring: Rect } {
  let region: Rect = {
    x: Math.min(start.x, goal.x),
    y: Math.min(start.y, goal.y),
    width: Math.abs(start.x - goal.x),
    height: Math.abs(start.y - goal.y),
  };
  const included = new Uint8Array(obstacles.length);
  const relevant: Rect[] = [];
  let grew = true;
  while (grew) {
    grew = false;
    const ring = expandRect(region, OBSTACLE_MARGIN);
    obstacles.forEach((obstacle, i) => {
      if (included[i] === 1 || !rectsTouch(obstacle, ring)) return;
      included[i] = 1;
      relevant.push(obstacle);
      region = unionRect(region, obstacle);
      grew = true;
    });
  }
  return { relevant, ring: expandRect(region, OBSTACLE_MARGIN) };
}

function uniqueSorted(values: number[]): number[] {
  values.sort((a, b) => a - b);
  const result: number[] = [];
  for (const value of values) {
    const last = result[result.length - 1];
    if (last === undefined || value - last > EPSILON) result.push(value);
  }
  return result;
}

/** Binary search for a coordinate that is known to be contained (within EPSILON). */
function indexOfCoordinate(sorted: readonly number[], value: number): number {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! < value - EPSILON) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
