import type { Anchor, Point, Side } from '../model/common';
import type { Port, Rect } from './geometry';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Converts an anchor (side + relative offset) into the absolute docking point on the rect border.
 * The offset runs left→right on top/bottom and top→bottom on left/right; it is clamped to 0..1.
 */
export function portFromAnchor(rect: Rect, anchor: Anchor): Port {
  const t = clamp01(anchor.offset);
  const { side } = anchor;
  switch (side) {
    case 'top':
      return { side, point: { x: rect.x + t * rect.width, y: rect.y } };
    case 'bottom':
      return { side, point: { x: rect.x + t * rect.width, y: rect.y + rect.height } };
    case 'left':
      return { side, point: { x: rect.x, y: rect.y + t * rect.height } };
    case 'right':
      return { side, point: { x: rect.x + rect.width, y: rect.y + t * rect.height } };
  }
}

/**
 * Finds the anchor closest to an arbitrary point, e.g. where the user dropped a dragged docking point:
 * the nearest side of the rect and the relative position of the projected point along it.
 */
export function anchorFromPoint(rect: Rect, point: Point): Anchor {
  const tx = rect.width > 0 ? clamp01((point.x - rect.x) / rect.width) : 0.5;
  const ty = rect.height > 0 ? clamp01((point.y - rect.y) / rect.height) : 0.5;
  const candidates: { side: Side; offset: number }[] = [
    { side: 'top', offset: tx },
    { side: 'right', offset: ty },
    { side: 'bottom', offset: tx },
    { side: 'left', offset: ty },
  ];
  let best: Anchor = { side: 'top', offset: tx };
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const onBorder = portFromAnchor(rect, candidate).point;
    const distance = Math.hypot(point.x - onBorder.x, point.y - onBorder.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}
