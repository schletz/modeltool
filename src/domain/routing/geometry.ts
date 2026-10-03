import type { Point, Side } from '../model/common';

/** Axis aligned rectangle in diagram coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A docking point on the border of a node. */
export interface Port {
  point: Point;
  side: Side;
}

/** Tolerance for comparing coordinates. */
export const EPSILON = 1e-6;

/** Outward unit normal of a rectangle side. */
export function sideNormal(side: Side): Point {
  switch (side) {
    case 'top':
      return { x: 0, y: -1 };
    case 'right':
      return { x: 1, y: 0 };
    case 'bottom':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
  }
}

/** Center point of a rectangle. */
export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Rectangle grown by `by` on every side. */
export function expandRect(rect: Rect, by: number): Rect {
  return { x: rect.x - by, y: rect.y - by, width: rect.width + 2 * by, height: rect.height + 2 * by };
}

/** Smallest rectangle containing both rectangles. */
export function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/** True if the closed rectangles share at least one point. */
export function rectsTouch(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;
}

/**
 * True if the axis-parallel segment a–b passes through the open interior of the rectangle.
 * Running along the border or touching it does not count.
 */
export function segmentCrossesRect(a: Point, b: Point, rect: Rect): boolean {
  return (
    Math.min(a.x, b.x) < rect.x + rect.width - EPSILON &&
    Math.max(a.x, b.x) > rect.x + EPSILON &&
    Math.min(a.y, b.y) < rect.y + rect.height - EPSILON &&
    Math.max(a.y, b.y) > rect.y + EPSILON
  );
}

/** True if both points coincide within {@link EPSILON}. */
export function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}

/** Element of a point list; throws instead of returning undefined for an invalid index. */
export function pointAt(points: readonly Point[], index: number): Point {
  const point = points[index];
  if (point === undefined) throw new RangeError(`No point at index ${index}`);
  return point;
}
