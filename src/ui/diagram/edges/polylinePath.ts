import type { Point } from '../../../domain/model/common';

/** SVG path data of a polyline. */
export function polylinePath(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}
