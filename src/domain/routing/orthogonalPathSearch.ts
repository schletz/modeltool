import type { Point } from '../model/common';
import { MinHeap } from './minHeap';
import { gridNodeAt, type OrthogonalGrid } from './orthogonalGrid';
import { BEND_PENALTY } from './routingConstants';

/** Travel direction: 0 = +x, 1 = +y, 2 = -x, 3 = -y (opposite = (d + 2) % 4). */
export type Direction = 0 | 1 | 2 | 3;

/** Direction of an axis-parallel unit vector. */
export function directionOf(vector: Point): Direction {
  if (vector.x > 0) return 0;
  if (vector.y > 0) return 1;
  if (vector.x < 0) return 2;
  return 3;
}

const turnCost = (from: number, to: number): number => {
  if (from === to) return 0;
  return (from + 2) % 4 === to ? Infinity : BEND_PENALTY;
};

/**
 * A* search for the cheapest orthogonal path (length + bend penalty) through the grid.
 *
 * A search state is a grid node plus the direction it was entered with, so bends can be priced
 * and U-turns forbidden. The path starts heading `startDir` and must arrive heading `goalDir`;
 * the final turn into `goalDir` is priced through a virtual terminal state.
 *
 * @returns the grid points from start to goal (inclusive), or null if the goal is unreachable.
 */
export function searchOrthogonalPath(
  grid: OrthogonalGrid,
  start: Point,
  startDir: Direction,
  goal: Point,
  goalDir: Direction,
): Point[] | null {
  const { xs, ys, blockedNode, blockedRight, blockedDown } = grid;
  const nx = xs.length;
  const ny = ys.length;
  const startNode = gridNodeAt(grid, start);
  const goalNode = gridNodeAt(grid, goal);
  if (blockedNode[startNode] === 1 || blockedNode[goalNode] === 1) return null;

  const xOf = (node: number): number => xs[node % nx]!;
  const yOf = (node: number): number => ys[Math.floor(node / nx)]!;
  const heuristic = (node: number): number => Math.abs(xOf(node) - goal.x) + Math.abs(yOf(node) - goal.y);

  const terminal = nx * ny * 4;
  const cost = new Float64Array(terminal + 1).fill(Infinity);
  const previous = new Int32Array(terminal + 1).fill(-1);
  const heap = new MinHeap();
  const startState = startNode * 4 + startDir;
  cost[startState] = 0;
  heap.push(startState, heuristic(startNode));

  while (heap.size > 0) {
    const { item: state, priority } = heap.pop()!;
    if (state === terminal) break;
    const node = state >> 2;
    const dir = state & 3;
    const g = cost[state]!;
    if (priority > g + heuristic(node) + 1e-9) continue; // stale heap entry

    if (node === goalNode) {
      const total = g + turnCost(dir, goalDir);
      if (total < cost[terminal]!) {
        cost[terminal] = total;
        previous[terminal] = state;
        heap.push(terminal, total);
      }
    }

    const ix = node % nx;
    const iy = Math.floor(node / nx);
    for (let d = 0; d < 4; d++) {
      if ((dir + 2) % 4 === d) continue;
      let next: number;
      if (d === 0) {
        if (ix + 1 >= nx || blockedRight[node] === 1) continue;
        next = node + 1;
      } else if (d === 1) {
        if (iy + 1 >= ny || blockedDown[node] === 1) continue;
        next = node + nx;
      } else if (d === 2) {
        if (ix === 0 || blockedRight[node - 1] === 1) continue;
        next = node - 1;
      } else {
        if (iy === 0 || blockedDown[node - nx] === 1) continue;
        next = node - nx;
      }
      const length = d % 2 === 0 ? Math.abs(xOf(next) - xOf(node)) : Math.abs(yOf(next) - yOf(node));
      const nextCost = g + length + (d === dir ? 0 : BEND_PENALTY);
      const nextState = next * 4 + d;
      if (nextCost < cost[nextState]!) {
        cost[nextState] = nextCost;
        previous[nextState] = state;
        heap.push(nextState, nextCost + heuristic(next));
      }
    }
  }

  if (previous[terminal] === -1) return null;
  const path: Point[] = [];
  for (let state = previous[terminal]!; state !== -1; state = previous[state]!) {
    const node = state >> 2;
    path.push({ x: xOf(node), y: yOf(node) });
  }
  return path.reverse();
}
