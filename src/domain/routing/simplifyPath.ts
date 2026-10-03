import type { Point } from '../model/common';
import { EPSILON, samePoint } from './geometry';

const collinear = (a: Point, b: Point, c: Point): boolean =>
  (Math.abs(a.x - b.x) < EPSILON && Math.abs(b.x - c.x) < EPSILON) ||
  (Math.abs(a.y - b.y) < EPSILON && Math.abs(b.y - c.y) < EPSILON);

/**
 * Removes duplicate points and middle points of straight runs from an orthogonal polyline.
 * Returns fresh point objects, so the result can be modified without aliasing the input.
 */
export function simplifyPath(points: readonly Point[]): Point[] {
  const result: Point[] = [];
  for (const p of points) {
    const point = { x: p.x, y: p.y };
    // Dropping a middle point can make the new neighbours collinear or equal again, hence the loop.
    for (;;) {
      const last = result[result.length - 1];
      const beforeLast = result[result.length - 2];
      if (last && samePoint(last, point)) break;
      if (last && beforeLast && collinear(beforeLast, last, point)) {
        result.pop();
        continue;
      }
      result.push(point);
      break;
    }
  }
  return result;
}
