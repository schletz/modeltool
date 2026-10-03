import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import type { Column, Table } from '../../../domain/model/physical';
import { useUiStore } from '../../store/uiStore';
import { useT } from '../../i18n/language';
import { keyLabel, tableRows } from '../geometry/displayRows';
import { tableColumnLayout } from '../geometry/nodeGeometry';
import { PhysicalEditor } from '../editor/PhysicalEditor';
import { NodeHandles } from './NodeHandles';

export type TableNodeType = Node<{ table: Table }, 'table'>;

function ColumnLine({ column, nameWidth }: { column: Column; nameWidth: number }) {
  const t = useT();
  return (
    <div className="node-row physical" data-row-id={column.id}>
      <span className="key-marker">{keyLabel(column.isPrimaryKey, column.fk !== undefined)}</span>
      <span className="row-name" style={{ minWidth: nameWidth }}>
        {column.name}
      </span>
      <span className="row-type">
        {column.dataType || (
          <span className="missing-type" title={t('table.missingType')}>
            ?
          </span>
        )}
      </span>
      <span className="row-flags">
        <span className={column.isNotNull ? 'flag on' : 'flag'} title="NOT NULL">
          NN
        </span>
        <span className={column.isUnique ? 'flag on' : 'flag'} title="UNIQUE">
          U
        </span>
        <span className={column.isIdentity ? 'flag on' : 'flag'} title="IDENTITY">
          ID
        </span>
      </span>
    </div>
  );
}

/** Table box of the physical model; turns into the inline editor while editing. */
export const TableNode = memo(function TableNode({ data, selected }: NodeProps<TableNodeType>) {
  const { table } = data;
  const editing = useUiStore((s) => s.editing?.nodeId === table.id);
  if (editing) {
    return (
      <div className="diagram-node table editing">
        <PhysicalEditor table={table} />
      </div>
    );
  }
  const { keyRows, otherRows } = tableRows(table);
  const { nameWidth } = tableColumnLayout(table);
  return (
    <div className={`diagram-node table${selected ? ' selected' : ''}`} data-testid="table-node">
      <div className="node-title">{table.name || <span className="placeholder">?</span>}</div>
      <div className="node-body">
        <div className="key-block">
          {keyRows.map((c) => (
            <ColumnLine key={c.id} column={c} nameWidth={nameWidth} />
          ))}
        </div>
        <div className="other-block">
          {otherRows.map((c) => (
            <ColumnLine key={c.id} column={c} nameWidth={nameWidth} />
          ))}
        </div>
      </div>
      <NodeHandles />
    </div>
  );
});
