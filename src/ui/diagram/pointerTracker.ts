import type { Point } from '../../domain/model/common';

let last: Point | null = null;

/** Remembers the last pointer position on the canvas (diagram coordinates) for keyboard shortcuts. */
export const pointerTracker = {
  update(point: Point): void {
    last = point;
  },
  get(): Point | null {
    return last;
  },
};
