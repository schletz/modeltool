import type { PointerEvent } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Anchor, Id } from '../../../domain/model/common';
import type { Port, Rect } from '../../../domain/routing/geometry';
import { anchorFromPoint } from '../../../domain/routing/anchors';
import { setAnchor } from '../../../domain/operations/relationshipOperations';
import { useDocumentStore } from '../../store/documentStore';
import { useUiStore } from '../../store/uiStore';

interface AnchorHandleProps {
  relationshipId: Id;
  end: 'source' | 'target';
  port: Port;
  nodeRect: Rect;
}

/**
 * Draggable docking point of a selected relationship. Dragging fixes the anchor on the
 * node border; a double click resets it to automatic placement.
 */
export function AnchorHandle({ relationshipId, end, port, nodeRect }: AnchorHandleProps) {
  const { screenToFlowPosition } = useReactFlow();
  const update = (anchor: Anchor | undefined, transient: boolean): void => {
    const view = useUiStore.getState().view;
    const store = useDocumentStore.getState();
    if (transient) store.commitTransient(view, (m) => setAnchor(m, relationshipId, end, anchor));
    else store.commit(view, (m) => setAnchor(m, relationshipId, end, anchor));
  };

  const onPointerDown = (e: PointerEvent<SVGRectElement>): void => {
    e.stopPropagation();
    e.preventDefault();
    const view = useUiStore.getState().view;
    useDocumentStore.getState().beginGesture(view);
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const move = (ev: globalThis.PointerEvent) => {
      const point = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
      update(anchorFromPoint(nodeRect, point), true);
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      useDocumentStore.getState().endGesture(view);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };

  return (
    <rect
      x={port.point.x - 3.5}
      y={port.point.y - 3.5}
      width={7}
      height={7}
      className="anchor-handle nodrag nopan"
      data-testid={`anchor-${end}`}
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        update(undefined, false);
      }}
    />
  );
}
