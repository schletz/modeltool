import type { Id, Point, Side } from '../model/common';
import { portFromAnchor } from './anchors';
import type { RoutingEdge } from './computeRoutes';
import { rectCenter, type Port, type Rect } from './geometry';
import { STUB_LENGTH } from './routingConstants';

/** Docking points of both ends of an edge. */
export interface PortPair {
  source: Port;
  target: Port;
}

type EdgeEnd = 'source' | 'target';

/** An automatic edge end waiting for its slot on a node side. */
interface AutoEnd {
  edgeId: Id;
  end: EdgeEnd;
  rect: Rect;
  side: Side;
  /** Position of the opposite end along this side; ends are ordered by it to avoid crossings. */
  sortKey: number;
  /** Tie breaker for ends with the same sort key (parallel edges, loops). */
  tieKey: number;
}

/**
 * Determines the docking points of all edges.
 *
 * Manual anchors are used as they are. Automatic ends get a side from the relative position
 * of the two nodes (recursive edges leave on the right and enter on the top), and all automatic
 * ends on the same node side are spread evenly at (i+1)/(k+1), ordered by the position of the
 * opposite end. Edges referencing an unknown node are skipped.
 */
export function assignPorts(rects: ReadonlyMap<Id, Rect>, edges: readonly RoutingEdge[]): Map<Id, PortPair> {
  const fixed = new Map<string, Port>();
  const groups = new Map<string, AutoEnd[]>();
  const routable: RoutingEdge[] = [];

  edges.forEach((edge, index) => {
    const sourceRect = rects.get(edge.sourceId);
    const targetRect = rects.get(edge.targetId);
    if (!sourceRect || !targetRect) return;
    routable.push(edge);

    const isLoop = edge.sourceId === edge.targetId;
    const [autoSourceSide, autoTargetSide]: [Side, Side] = isLoop
      ? ['right', 'top']
      : facingSides(sourceRect, targetRect);
    const ends = [
      { end: 'source' as const, rect: sourceRect, anchor: edge.sourceAnchor, autoSide: autoSourceSide, nodeId: edge.sourceId },
      { end: 'target' as const, rect: targetRect, anchor: edge.targetAnchor, autoSide: autoTargetSide, nodeId: edge.targetId },
    ];
    for (const [i, current] of ends.entries()) {
      if (current.anchor) {
        fixed.set(endKey(edge.id, current.end), portFromAnchor(current.rect, current.anchor));
        continue;
      }
      const opposite = ends[1 - i];
      if (!opposite) continue;
      let reference: Point;
      if (opposite.anchor) reference = portFromAnchor(opposite.rect, opposite.anchor).point;
      else if (isLoop) reference = { x: sourceRect.x + sourceRect.width, y: sourceRect.y };
      else reference = rectCenter(opposite.rect);

      const horizontalSide = current.autoSide === 'top' || current.autoSide === 'bottom';
      // Nested loops must be ordered towards the shared top-right corner on both sides: ascending
      // from the top on the right side, but descending from the right on the top side.
      const tieKey = isLoop && current.end === 'target' ? -index : index;
      const groupKey = `${current.nodeId}|${current.autoSide}`;
      const group = groups.get(groupKey) ?? [];
      group.push({
        edgeId: edge.id,
        end: current.end,
        rect: current.rect,
        side: current.autoSide,
        sortKey: horizontalSide ? reference.x : reference.y,
        tieKey,
      });
      groups.set(groupKey, group);
    }
  });

  for (const group of groups.values()) {
    group.sort((a, b) => a.sortKey - b.sortKey || a.tieKey - b.tieKey);
    group.forEach((autoEnd, i) => {
      const offset = (i + 1) / (group.length + 1);
      fixed.set(endKey(autoEnd.edgeId, autoEnd.end), portFromAnchor(autoEnd.rect, { side: autoEnd.side, offset }));
    });
  }

  const result = new Map<Id, PortPair>();
  for (const edge of routable) {
    const source = fixed.get(endKey(edge.id, 'source'));
    const target = fixed.get(endKey(edge.id, 'target'));
    if (source && target) result.set(edge.id, { source, target });
  }
  return result;
}

/**
 * Chooses the sides of two different nodes for automatic docking points.
 * The dominant separation decides between left/right and top/bottom. If the nodes are too close
 * (or overlap) for two facing stubs, both ends dock on the same outer side so the line runs
 * around them like a bracket.
 */
function facingSides(source: Rect, target: Rect): [Side, Side] {
  const gapX = Math.max(target.x - (source.x + source.width), source.x - (target.x + target.width));
  const gapY = Math.max(target.y - (source.y + source.height), source.y - (target.y + target.height));
  const horizontal = gapX >= gapY;
  if ((horizontal ? gapX : gapY) < 2 * STUB_LENGTH) return horizontal ? ['top', 'top'] : ['left', 'left'];

  const s = rectCenter(source);
  const t = rectCenter(target);
  if (horizontal) return t.x >= s.x ? ['right', 'left'] : ['left', 'right'];
  return t.y >= s.y ? ['bottom', 'top'] : ['top', 'bottom'];
}

const endKey = (edgeId: Id, end: EdgeEnd): string => `${end}|${edgeId}`;
