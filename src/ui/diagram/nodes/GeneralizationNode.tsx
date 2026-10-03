import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import type { Generalization } from '../../../domain/model/logical';
import { GENERALIZATION_RADIUS, GENERALIZATION_SIZE } from '../geometry/diagramMetrics';
import { NodeHandles } from './NodeHandles';

export type GeneralizationNodeType = Node<{ generalization: Generalization }, 'generalization'>;

/** Category circle; one bar below it = incomplete, two bars = complete. */
export const GeneralizationNode = memo(function GeneralizationNode({ data, selected }: NodeProps<GeneralizationNodeType>) {
  const { width, height } = GENERALIZATION_SIZE;
  const r = GENERALIZATION_RADIUS;
  const cx = width / 2;
  const barY = 2 * r + 5;
  return (
    <div className={`generalization-node${selected ? ' selected' : ''}`} data-testid="generalization-node">
      <svg width={width} height={height}>
        <circle cx={cx} cy={r + 1} r={r} className="category-circle" />
        <line x1={cx - r - 1} x2={cx + r + 1} y1={barY} y2={barY} className="category-bar" />
        {data.generalization.isComplete && (
          <line x1={cx - r - 1} x2={cx + r + 1} y1={barY + 4} y2={barY + 4} className="category-bar" />
        )}
      </svg>
      <NodeHandles connectable={false} />
    </div>
  );
});
