import { describe, expect, it } from 'vitest';
import { anchorFromPoint, portFromAnchor } from './anchors';

const rect = { x: 100, y: 50, width: 200, height: 100 };

describe('portFromAnchor', () => {
  it('places the point along the side, left to right and top to bottom', () => {
    expect(portFromAnchor(rect, { side: 'top', offset: 0.25 })).toEqual({ side: 'top', point: { x: 150, y: 50 } });
    expect(portFromAnchor(rect, { side: 'bottom', offset: 1 })).toEqual({ side: 'bottom', point: { x: 300, y: 150 } });
    expect(portFromAnchor(rect, { side: 'left', offset: 0.5 })).toEqual({ side: 'left', point: { x: 100, y: 100 } });
    expect(portFromAnchor(rect, { side: 'right', offset: 0 })).toEqual({ side: 'right', point: { x: 300, y: 50 } });
  });

  it('clamps offsets outside 0..1', () => {
    expect(portFromAnchor(rect, { side: 'top', offset: 1.5 }).point).toEqual({ x: 300, y: 50 });
    expect(portFromAnchor(rect, { side: 'left', offset: -1 }).point).toEqual({ x: 100, y: 50 });
  });
});

describe('anchorFromPoint', () => {
  it('picks the nearest side and the projected offset', () => {
    expect(anchorFromPoint(rect, { x: 150, y: 40 })).toEqual({ side: 'top', offset: 0.25 });
    expect(anchorFromPoint(rect, { x: 310, y: 125 })).toEqual({ side: 'right', offset: 0.75 });
    expect(anchorFromPoint(rect, { x: 250, y: 140 })).toEqual({ side: 'bottom', offset: 0.75 });
    expect(anchorFromPoint(rect, { x: 105, y: 90 })).toEqual({ side: 'left', offset: 0.4 });
  });

  it('clamps points beyond the corners', () => {
    expect(anchorFromPoint(rect, { x: 500, y: 60 })).toEqual({ side: 'right', offset: 0.1 });
  });

  it('round-trips with portFromAnchor', () => {
    const anchor = { side: 'bottom' as const, offset: 0.3 };
    expect(anchorFromPoint(rect, portFromAnchor(rect, anchor).point)).toEqual(anchor);
  });
});
