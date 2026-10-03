import { moveLogicalNodes } from '../../domain/operations/logicalOperations';
import { moveTables } from '../../domain/operations/physicalOperations';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';
import { buildScene } from '../diagram/scene/buildScene';

/** Arranges all nodes of the current view; one undo step (spec 8.3). */
export async function autoArrange(): Promise<void> {
  const view = useUiStore.getState().view;
  const scene = buildScene(useDocumentStore.getState().doc, view, null);
  // ELK is large, so it is only loaded when needed.
  const { computeAutoLayout } = await import('../services/autoLayout');
  const positions = await computeAutoLayout(scene);
  const store = useDocumentStore.getState();
  if (view === 'logical') store.commit('logical', (m) => moveLogicalNodes(m, positions));
  else store.commit('physical', (m) => moveTables(m, positions));
}
