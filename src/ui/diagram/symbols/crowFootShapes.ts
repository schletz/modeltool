import type { Cardinality, Side } from '../../../domain/model/common';

/**
 * Primitive shapes of a crow's foot symbol in local coordinates: x runs outward
 * from the node border along the line, y perpendicular to it.
 */
export type SymbolShape =
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'circle'; cx: number; cy: number; r: number };

const HALF = 7;
const bar = (x: number): SymbolShape => ({ type: 'line', x1: x, y1: -HALF, x2: x, y2: HALF });
const circle = (cx: number): SymbolShape => ({ type: 'circle', cx, cy: 0, r: 4.5 });
const crowFoot: SymbolShape[] = [
  { type: 'line', x1: 0, y1: -8, x2: 12, y2: 0 },
  { type: 'line', x1: 0, y1: 8, x2: 12, y2: 0 },
];

/**
 * Shapes of a cardinality: the symbol next to the border shows the maximum,
 * the one further out the minimum (bar = 1, circle = 0).
 */
export function cardinalityShapes(cardinality: Cardinality): SymbolShape[] {
  switch (cardinality) {
    case 'one':
      return [bar(8), bar(14)];
    case 'zeroOrOne':
      return [bar(8), circle(19)];
    case 'oneOrMany':
      return [...crowFoot, bar(17)];
    case 'zeroOrMany':
      return [...crowFoot, circle(19)];
  }
}

/** Rotation (degrees) that maps the local x axis onto the outward normal of a side. */
export function sideRotation(side: Side): number {
  switch (side) {
    case 'right':
      return 0;
    case 'bottom':
      return 90;
    case 'left':
      return 180;
    case 'top':
      return -90;
  }
}
