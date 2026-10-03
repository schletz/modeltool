import type { Point } from '../model/common';
import { EPSILON, pointAt, segmentCrossesRect, type Rect } from './geometry';
import { LANE_SPACING, STUB_LENGTH } from './routingConstants';

type Axis = 'x' | 'y';

/** An inner segment of a route (never the first or last one, which are anchored at the ports). */
interface InnerSegment {
  route: Point[];
  /** The segment runs from route[index] to route[index + 1]. */
  index: number;
  /** Position of the route in the input, used as stable tie breaker. */
  order: number;
  /** Constant coordinate of the segment (x of a vertical segment). */
  coord: number;
  lo: number;
  hi: number;
}

/**
 * Pulls apart inner segments of different routes that lie on top of each other (e.g. parallel
 * edges taking the same channel) by moving them into lanes {@link LANE_SPACING} apart.
 *
 * Lanes are ordered so the moved lines do not cross each other where avoidable. A shift is only
 * applied when the stubs keep their minimum length, no neighbouring segment flips direction and
 * no obstacle interior is entered. Routes are modified in place.
 */
export function separateOverlaps(routes: readonly Point[][], obstacles: readonly Rect[]): void {
  // Vertical segments first; shifting them only changes the length of horizontal ones, which are
  // collected afterwards from the updated geometry.
  separatePass(routes, obstacles, 'x');
  separatePass(routes, obstacles, 'y');
}

/** Handles all segments whose constant coordinate is `across` (x → vertical segments). */
function separatePass(routes: readonly Point[][], obstacles: readonly Rect[], across: Axis): void {
  const along: Axis = across === 'x' ? 'y' : 'x';
  const segments: InnerSegment[] = [];
  routes.forEach((route, order) => {
    for (let index = 1; index <= route.length - 3; index++) {
      const a = pointAt(route, index);
      const b = pointAt(route, index + 1);
      if (Math.abs(a[across] - b[across]) > EPSILON) continue;
      segments.push({ route, index, order, coord: a[across], lo: Math.min(a[along], b[along]), hi: Math.max(a[along], b[along]) });
    }
  });
  segments.sort((s, t) => s.coord - t.coord || s.lo - t.lo);

  // Sweep for clusters of collinear segments with overlapping extent.
  let cluster: InnerSegment[] = [];
  let clusterHi = -Infinity;
  for (const segment of segments) {
    const first = cluster[0];
    if (first && Math.abs(segment.coord - first.coord) < EPSILON && segment.lo < clusterHi - EPSILON) {
      cluster.push(segment);
      clusterHi = Math.max(clusterHi, segment.hi);
      continue;
    }
    spreadCluster(cluster, obstacles, across);
    cluster = [segment];
    clusterHi = segment.hi;
  }
  spreadCluster(cluster, obstacles, across);
}

/** Lane order information: where the segment's neighbours branch off and to which side. */
interface LaneInfo {
  segment: InnerSegment;
  startPos: number;
  startDir: number;
  endPos: number;
  endDir: number;
}

function spreadCluster(cluster: readonly InnerSegment[], obstacles: readonly Rect[], across: Axis): void {
  if (new Set(cluster.map((s) => s.route)).size < 2) return;
  const along: Axis = across === 'x' ? 'y' : 'x';
  const lanes = cluster.map((segment) => laneInfo(segment, along, across)).sort(compareLanes);
  const k = lanes.length;

  // Prefer lanes centred on the original channel; fall back to spreading towards one side only,
  // which matters when a channel runs right at a stub end and one direction is blocked.
  const placements = [
    (j: number) => (j - (k - 1) / 2) * LANE_SPACING,
    (j: number) => j * LANE_SPACING,
    (j: number) => (j - (k - 1)) * LANE_SPACING,
  ];
  for (const offsetOf of placements) {
    if (lanes.every((lane, j) => canShift(lane.segment, offsetOf(j), across, obstacles))) {
      lanes.forEach((lane, j) => shift(lane.segment, offsetOf(j), across));
      return;
    }
  }
}

function laneInfo(segment: InnerSegment, along: Axis, across: Axis): LaneInfo {
  const { route, index } = segment;
  const a = pointAt(route, index);
  const b = pointAt(route, index + 1);
  const beforeA = pointAt(route, index - 1);
  const afterB = pointAt(route, index + 2);
  const [start, startNeighbour, end, endNeighbour] = a[along] <= b[along] ? [a, beforeA, b, afterB] : [b, afterB, a, beforeA];
  return {
    segment,
    startPos: start[along],
    startDir: Math.sign(startNeighbour[across] - start[across]),
    endPos: end[along],
    endDir: Math.sign(endNeighbour[across] - end[across]),
  };
}

/**
 * Negative if `a` belongs into the lane with the smaller coordinate.
 *
 * Example for vertical segments whose upper neighbours both branch off to the left: the line
 * branching off higher up must take the lane further right, otherwise its horizontal neighbour
 * would cross the other vertical segment. The other cases follow by symmetry.
 */
function compareLanes(a: LaneInfo, b: LaneInfo): number {
  if (a.startDir === b.startDir && a.startPos !== b.startPos) return (a.startPos - b.startPos) * a.startDir;
  if (a.endDir === b.endDir && a.endPos !== b.endPos) return (b.endPos - a.endPos) * a.endDir;
  return a.segment.order - b.segment.order;
}

function canShift(segment: InnerSegment, delta: number, across: Axis, obstacles: readonly Rect[]): boolean {
  if (delta === 0) return true;
  const { route, index } = segment;
  const last = route.length - 1;
  const before = pointAt(route, index - 1);
  const a = pointAt(route, index);
  const b = pointAt(route, index + 1);
  const after = pointAt(route, index + 2);

  // The neighbouring segments run along `across` and get longer or shorter by delta.
  const lengthBefore = a[across] - before[across];
  const lengthAfter = after[across] - b[across];
  if (!keepsDirection(lengthBefore, lengthBefore + delta, index - 1 === 0 ? STUB_LENGTH : 1)) return false;
  if (!keepsDirection(lengthAfter, lengthAfter - delta, index + 2 === last ? STUB_LENGTH : 1)) return false;

  const movedA = withCoordinate(a, across, a[across] + delta);
  const movedB = withCoordinate(b, across, b[across] + delta);
  return !obstacles.some(
    (rect) =>
      segmentCrossesRect(before, movedA, rect) || segmentCrossesRect(movedA, movedB, rect) || segmentCrossesRect(movedB, after, rect),
  );
}

function shift(segment: InnerSegment, delta: number, across: Axis): void {
  const { route, index } = segment;
  route[index] = withCoordinate(pointAt(route, index), across, pointAt(route, index)[across] + delta);
  route[index + 1] = withCoordinate(pointAt(route, index + 1), across, pointAt(route, index + 1)[across] + delta);
}

const keepsDirection = (oldLength: number, newLength: number, minLength: number): boolean =>
  Math.sign(oldLength) === Math.sign(newLength) && Math.abs(newLength) >= minLength - EPSILON;

const withCoordinate = (p: Point, axis: Axis, value: number): Point => (axis === 'x' ? { x: value, y: p.y } : { x: p.x, y: value });
