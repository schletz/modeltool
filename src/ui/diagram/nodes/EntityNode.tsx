import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import type { Entity } from '../../../domain/model/logical';
import { useDocumentStore } from '../../store/documentStore';
import { useUiStore } from '../../store/uiStore';
import { entityRows, type EntityRow } from '../geometry/displayRows';
import { LogicalEditor } from '../editor/LogicalEditor';
import { NodeHandles } from './NodeHandles';

export type EntityNodeType = Node<{ entity: Entity }, 'entity'>;

function AttributeLine({ row }: { row: EntityRow }) {
  return (
    <div className={`node-row${row.isInherited ? ' inherited' : ''}`} data-row-id={row.id}>
      <span className="key-marker">{row.keyLabel}</span>
      <span className="row-name">{row.name}</span>
      <span className="row-flag">{row.isOptional ? 'o' : '*'}</span>
    </div>
  );
}

/** Entity box of the logical model; turns into the inline editor while editing. */
export const EntityNode = memo(function EntityNode({ data, selected }: NodeProps<EntityNodeType>) {
  const { entity } = data;
  const model = useDocumentStore((s) => s.doc.logical);
  const editing = useUiStore((s) => s.editing?.nodeId === entity.id);
  const isSubtype = model.generalizations.some((g) => g.subtypeIds.includes(entity.id));

  if (editing) {
    return (
      <div className="diagram-node entity editing">
        <LogicalEditor entity={entity} />
      </div>
    );
  }
  const { keyRows, otherRows } = entityRows(model, entity);
  return (
    <div className={`diagram-node entity${selected ? ' selected' : ''}${isSubtype ? ' subtype' : ''}`} data-testid="entity-node">
      <div className="node-title">{entity.name || <span className="placeholder">?</span>}</div>
      <div className="node-body">
        <div className="key-block">
          {keyRows.map((r) => (
            <AttributeLine key={r.id} row={r} />
          ))}
        </div>
        <div className="other-block">
          {otherRows.map((r) => (
            <AttributeLine key={r.id} row={r} />
          ))}
        </div>
      </div>
      <NodeHandles />
    </div>
  );
});
