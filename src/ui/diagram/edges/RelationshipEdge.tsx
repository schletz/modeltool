import { memo } from 'react';
import { BaseEdge, type Edge, type EdgeProps } from '@xyflow/react';
import type { Relationship } from '../../../domain/model/common';
import { nextCardinality } from '../../../domain/cardinality';
import { setCardinality } from '../../../domain/operations/relationshipOperations';
import { applyParentCardinalityToForeignKeys } from '../../../domain/foreignKeys/physicalForeignKeys';
import { useDocumentStore } from '../../store/documentStore';
import { useUiStore } from '../../store/uiStore';
import { useScene } from '../scene/SceneContext';
import { CardinalitySymbol } from './CardinalitySymbol';
import { AnchorHandle } from './AnchorHandle';
import { polylinePath } from './polylinePath';

export type RelationshipEdgeType = Edge<{ relationship: Relationship }, 'relationship'>;

/** Changes one end's symbol; in the physical view the FK nullability follows the parent end. */
export function changeCardinality(relationship: Relationship, end: 'source' | 'target', cardinality: Relationship['sourceCardinality']): void {
  const view = useUiStore.getState().view;
  const store = useDocumentStore.getState();
  if (view === 'logical') {
    store.commit('logical', (m) => setCardinality(m, relationship.id, end, cardinality));
  } else {
    store.commit('physical', (m) => applyParentCardinalityToForeignKeys(setCardinality(m, relationship.id, end, cardinality), relationship.id));
  }
}

/** Orthogonal relationship line with crow's foot symbols; dashed = non identifying. */
export const RelationshipEdge = memo(function RelationshipEdge({ id, data, selected }: EdgeProps<RelationshipEdgeType>) {
  const scene = useScene();
  const route = scene.routes.get(id);
  if (!route || !data) return null;
  const rel = data.relationship;
  const rectOf = (nodeId: string) => scene.nodes.find((n) => n.id === nodeId)?.rect;
  const sourceRect = rectOf(rel.sourceId);
  const targetRect = rectOf(rel.targetId);

  const cycle = (end: 'source' | 'target') => () => {
    useUiStore.getState().select({ kind: 'edge', id });
    changeCardinality(rel, end, nextCardinality(end === 'source' ? rel.sourceCardinality : rel.targetCardinality));
  };

  return (
    <g className={`relationship-edge${selected ? ' selected' : ''}${rel.isIdentifying ? '' : ' non-identifying'}`} data-testid="relationship-edge" data-id={id}>
      <BaseEdge id={id} path={polylinePath(route.points)} interactionWidth={14} />
      <CardinalitySymbol port={route.source} cardinality={rel.sourceCardinality} onClick={cycle('source')} testId="cardinality-source" />
      <CardinalitySymbol port={route.target} cardinality={rel.targetCardinality} onClick={cycle('target')} testId="cardinality-target" />
      {selected && sourceRect && <AnchorHandle relationshipId={id} end="source" port={route.source} nodeRect={sourceRect} />}
      {selected && targetRect && <AnchorHandle relationshipId={id} end="target" port={route.target} nodeRect={targetRect} />}
    </g>
  );
});
