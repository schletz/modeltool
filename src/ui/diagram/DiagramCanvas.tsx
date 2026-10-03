import { useCallback, useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type OnConnectEnd,
  type OnConnectStart,
} from '@xyflow/react';
import type { Id, Point } from '../../domain/model/common';
import type { ViewKind } from '../../domain/model/document';
import { moveLogicalNodes } from '../../domain/operations/logicalOperations';
import { moveTables } from '../../domain/operations/physicalOperations';
import { moveNotes } from '../../domain/operations/noteOperations';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';
import { useT } from '../i18n/language';
import { connectNodes, createNodeAt } from '../commands/editCommands';
import { buildScene, type SceneNode } from './scene/buildScene';
import { SceneContext } from './scene/SceneContext';
import { EntityNode } from './nodes/EntityNode';
import { TableNode } from './nodes/TableNode';
import { GeneralizationNode } from './nodes/GeneralizationNode';
import { NoteNode } from './nodes/NoteNode';
import { RelationshipEdge } from './edges/RelationshipEdge';
import { GeneralizationEdge } from './edges/GeneralizationEdge';
import { GRID_SIZE } from './geometry/diagramMetrics';
import { pointerTracker } from './pointerTracker';
import { ContextBar } from './ContextBar';
import { TablePropertiesPanel } from './TablePropertiesPanel';

const nodeTypes = { entity: EntityNode, table: TableNode, generalization: GeneralizationNode, note: NoteNode };
const edgeTypes = { relationship: RelationshipEdge, generalization: GeneralizationEdge };

/** Minimum pointer travel so that a click on a docking point does not create a recursive relationship. */
const MIN_CONNECT_DISTANCE = 12;

function nodeData(node: SceneNode): Record<string, unknown> {
  switch (node.kind) {
    case 'entity':
      return { entity: node.entity };
    case 'table':
      return { table: node.table };
    case 'generalization':
      return { generalization: node.generalization };
    case 'note':
      return { note: node.note };
  }
}

function movePositions(view: ViewKind, positions: Map<Id, Point>): void {
  const store = useDocumentStore.getState();
  if (view === 'logical') store.commitTransient('logical', (m) => moveNotes(moveLogicalNodes(m, positions), positions));
  else store.commitTransient('physical', (m) => moveNotes(moveTables(m, positions), positions));
}

function nodeIdAt(clientX: number, clientY: number): Id | null {
  const element = document.elementFromPoint(clientX, clientY);
  const node = element?.closest('.react-flow__node');
  return node?.getAttribute('data-id') ?? null;
}

/** The drawing area of the current view (React Flow with our own nodes, edges and routing). */
export function DiagramCanvas() {
  const t = useT();
  const view = useUiStore((s) => s.view);
  const selection = useUiStore((s) => s.selection);
  const editingId = useUiStore((s) => s.editing?.nodeId ?? null);
  const showGrid = useUiStore((s) => s.showGrid);
  const focusRequest = useUiStore((s) => s.focusRequest);
  const doc = useDocumentStore((s) => s.doc);
  const { screenToFlowPosition, setCenter } = useReactFlow();
  const connectStart = useRef<{ nodeId: Id; x: number; y: number } | null>(null);

  const viewModel = doc[view];
  // The scene only depends on the visible model, not on the other view.
  const scene = useMemo(() => buildScene(doc, view, editingId), [viewModel, view, editingId]);

  const nodes = useMemo<Node[]>(
    () =>
      scene.nodes.map((n) => ({
        id: n.id,
        type: n.kind,
        position: { x: n.rect.x, y: n.rect.y },
        width: n.rect.width,
        height: n.rect.height,
        data: nodeData(n),
        selected: selection?.kind === 'node' && selection.id === n.id,
        draggable: n.id !== editingId,
        zIndex: n.kind === 'note' ? 0 : n.id === editingId ? 10 : 1,
      })),
    [scene, selection, editingId],
  );

  const edges = useMemo<Edge[]>(
    () =>
      scene.edges.map((e) => ({
        id: e.id,
        type: e.kind,
        source: e.sourceId,
        target: e.targetId,
        sourceHandle: 'out',
        targetHandle: 'in',
        data: e.kind === 'relationship' ? { relationship: e.relationship } : {},
        selected: selection?.kind === 'edge' && selection.id === e.id,
        zIndex: 2,
      })),
    [scene, selection],
  );

  useEffect(() => {
    if (!focusRequest) return;
    const node = scene.nodes.find((n) => n.id === focusRequest.id);
    if (node) void setCenter(node.rect.x + node.rect.width / 2, node.rect.y + node.rect.height / 2, { zoom: 1.2, duration: 300 });
    // Only react to new requests, not to scene changes.
  }, [focusRequest]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const positions = new Map<Id, Point>();
      for (const change of changes) {
        if (change.type === 'position' && change.position) positions.set(change.id, change.position);
      }
      if (positions.size > 0) movePositions(view, positions);
    },
    [view],
  );

  const onConnectStart: OnConnectStart = useCallback((event, params) => {
    const point = 'clientX' in event ? event : event.touches[0];
    if (!params.nodeId || !point) return;
    connectStart.current = { nodeId: params.nodeId, x: point.clientX, y: point.clientY };
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback((event) => {
    const start = connectStart.current;
    connectStart.current = null;
    const point = 'clientX' in event ? event : event.changedTouches[0];
    if (!start || !point) return;
    if (Math.hypot(point.clientX - start.x, point.clientY - start.y) < MIN_CONNECT_DISTANCE) return;
    // Dropping anywhere on a node connects to it, not only on its docking points.
    const targetId = nodeIdAt(point.clientX, point.clientY);
    if (targetId) connectNodes(start.nodeId, targetId);
  }, []);

  const onDoubleClick = (event: ReactMouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.classList.contains('react-flow__pane')) return;
    const p = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    createNodeAt({ x: Math.round(p.x / GRID_SIZE) * GRID_SIZE, y: Math.round(p.y / GRID_SIZE) * GRID_SIZE });
  };

  return (
    <SceneContext.Provider value={scene}>
      <div
        className="diagram-canvas"
        data-testid="canvas"
        onMouseMove={(e) => pointerTracker.update(screenToFlowPosition({ x: e.clientX, y: e.clientY }))}
        onDoubleClick={onDoubleClick}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStart={() => useDocumentStore.getState().beginGesture(view)}
          onNodeDragStop={() => useDocumentStore.getState().endGesture(view)}
          onNodeClick={(_, node) => {
            const ui = useUiStore.getState();
            if (ui.editing && ui.editing.nodeId !== node.id) ui.stopEditing();
            ui.select({ kind: 'node', id: node.id });
          }}
          onNodeDoubleClick={(_, node) => {
            if (node.type !== 'generalization') useUiStore.getState().startEditing(node.id);
          }}
          onEdgeClick={(_, edge) => useUiStore.getState().select({ kind: 'edge', id: edge.id })}
          onPaneClick={() => {
            useUiStore.getState().select(null);
            useUiStore.getState().stopEditing();
          }}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          connectionMode={ConnectionMode.Loose}
          connectOnClick={false}
          snapToGrid
          snapGrid={[GRID_SIZE, GRID_SIZE]}
          panOnDrag={[1]}
          panActivationKeyCode="Space"
          selectionOnDrag={false}
          zoomOnDoubleClick={false}
          deleteKeyCode={null}
          multiSelectionKeyCode={null}
          selectionKeyCode={null}
          minZoom={0.15}
          maxZoom={2.5}
          fitView
          fitViewOptions={{ maxZoom: 1 }}
        >
          {showGrid && <Background variant={BackgroundVariant.Lines} gap={GRID_SIZE} color="var(--grid-color)" />}
          <MiniMap pannable zoomable nodeStrokeWidth={2} />
          <Controls showInteractive={false} />
          {scene.nodes.length === 0 && (
            <Panel position="top-center" className="canvas-hint">
              {t(view === 'logical' ? 'canvas.hint' : 'canvas.hintPhysical')}
            </Panel>
          )}
          <ContextBar />
          <TablePropertiesPanel />
        </ReactFlow>
      </div>
    </SceneContext.Provider>
  );
}
