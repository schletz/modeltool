import type { Id } from '../../domain/model/common';
import type { GeneralizationStrategy } from '../../domain/model/logical';
import { validateLogical } from '../../domain/validation/logicalValidation';
import { transformToPhysical } from '../../domain/transform/transformToPhysical';
import { updateGeneralization } from '../../domain/operations/logicalOperations';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';

export type Strategies = Record<Id, GeneralizationStrategy>;

/** Strategies preselected in the dialog: the last choice stored in the model, default roll up. */
export function preselectedStrategies(): Strategies {
  const { generalizations } = useDocumentStore.getState().doc.logical;
  return Object.fromEntries(generalizations.map((g) => [g.id, g.strategy ?? 'rollUp']));
}

/** Step 1 (spec 4.1): validate without strategies, then ask for strategies/confirmation in the dialog. */
export function startTransformation(): void {
  const ui = useUiStore.getState();
  const issues = validateLogical(useDocumentStore.getState().doc.logical);
  if (issues.length > 0) {
    ui.showIssues({ issues, context: 'transform' });
    return;
  }
  ui.showIssues(null);
  ui.openDialog('transform');
}

/**
 * Validates with the chosen strategies (roll down rules), stores them in the model and
 * replaces the physical model as one undo step. Returns false if blockers were found.
 */
export function runTransformation(strategies: Strategies): boolean {
  const store = useDocumentStore.getState();
  const ui = useUiStore.getState();
  const issues = validateLogical(store.doc.logical, strategies);
  if (issues.length > 0) {
    ui.openDialog(null);
    ui.showIssues({ issues, context: 'transform' });
    return false;
  }
  const changed = store.doc.logical.generalizations.some((g) => g.strategy !== strategies[g.id]);
  if (changed) {
    store.commit('logical', (m) =>
      Object.entries(strategies).reduce((acc, [id, strategy]) => updateGeneralization(acc, id, { strategy }), m),
    );
  }
  const { doc } = useDocumentStore.getState();
  const physical = transformToPhysical(doc.logical, doc.settings, strategies, doc.physical);
  store.commit('physical', () => physical);
  ui.openDialog(null);
  ui.setView('physical');
  return true;
}
