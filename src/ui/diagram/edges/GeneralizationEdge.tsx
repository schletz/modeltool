import { memo } from 'react';
import { BaseEdge, type Edge, type EdgeProps } from '@xyflow/react';
import { useScene } from '../scene/SceneContext';
import { polylinePath } from './polylinePath';

export type GeneralizationEdgeType = Edge<Record<string, never>, 'generalization'>;

/** Plain line between supertype and category circle or circle and subtype. */
export const GeneralizationEdge = memo(function GeneralizationEdge({ id, selected }: EdgeProps<GeneralizationEdgeType>) {
  const route = useScene().routes.get(id);
  if (!route) return null;
  return (
    <g className={`generalization-edge${selected ? ' selected' : ''}`}>
      <BaseEdge id={id} path={polylinePath(route.points)} interactionWidth={12} />
    </g>
  );
});
