import ELK from 'elkjs/lib/elk.bundled.js';
import type { Id, Point } from '../../domain/model/common';
import type { Scene } from '../diagram/scene/buildScene';
import { GRID_SIZE } from '../diagram/geometry/diagramMetrics';

const elk = new ELK();

/**
 * Computes new positions for all entities/tables (and generalization circles) of a scene
 * with ELK's layered algorithm, which minimizes edge crossings. Notes keep their position.
 */
export async function computeAutoLayout(scene: Scene): Promise<Map<Id, Point>> {
  const layoutNodes = scene.nodes.filter((n) => n.kind !== 'note');
  const ids = new Set(layoutNodes.map((n) => n.id));
  const graph = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.spacing.nodeNode': '64',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.separateConnectedComponents': 'true',
    },
    children: layoutNodes.map((n) => ({ id: n.id, width: n.rect.width, height: n.rect.height })),
    edges: scene.edges
      .filter((e) => e.sourceId !== e.targetId && ids.has(e.sourceId) && ids.has(e.targetId))
      .map((e) => ({ id: e.id, sources: [e.sourceId], targets: [e.targetId] })),
  });

  const origin = topLeft(scene);
  const snap = (v: number) => Math.round(v / GRID_SIZE) * GRID_SIZE;
  const positions = new Map<Id, Point>();
  for (const child of graph.children ?? []) {
    positions.set(child.id, { x: snap(origin.x + (child.x ?? 0)), y: snap(origin.y + (child.y ?? 0)) });
  }
  return positions;
}

/** Keeps the layout roughly where the diagram was before. */
function topLeft(scene: Scene): Point {
  const nodes = scene.nodes.filter((n) => n.kind !== 'note');
  if (nodes.length === 0) return { x: 0, y: 0 };
  return { x: Math.min(...nodes.map((n) => n.rect.x)), y: Math.min(...nodes.map((n) => n.rect.y)) };
}
