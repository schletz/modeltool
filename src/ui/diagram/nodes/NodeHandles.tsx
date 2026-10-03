import { Handle, Position } from '@xyflow/react';

const SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const;

/**
 * Docking points to start drawing a relationship (visible on hover), plus two hidden
 * handles React Flow needs to attach edges; the line geometry comes from our own router.
 */
export function NodeHandles({ connectable = true }: { connectable?: boolean }) {
  return (
    <>
      {connectable &&
        SIDES.map((s) => (
          <Handle key={s.id} id={s.id} type="source" position={s.position} className="dock-handle" />
        ))}
      <Handle id="out" type="source" position={Position.Top} className="hidden-handle" isConnectable={false} />
      <Handle id="in" type="target" position={Position.Top} className="hidden-handle" isConnectable={false} />
    </>
  );
}
