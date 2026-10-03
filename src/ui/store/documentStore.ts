import { create } from 'zustand';
import { createEmptyDocument, type ModelDocument, type ModelMeta, type ModelSettings, type ViewKind } from '../../domain/model/document';
import type { LogicalModel } from '../../domain/model/logical';
import type { PhysicalModel } from '../../domain/model/physical';
import type { NamingConvention } from '../../domain/model/common';
import { syncLogicalForeignKeys } from '../../domain/foreignKeys/logicalForeignKeys';
import { syncPhysicalForeignKeys } from '../../domain/foreignKeys/physicalForeignKeys';
import { emptyHistory, record, redoStep, undoStep, type History } from './history';

export interface CommitOptions {
  /** Consecutive commits with the same key form one undo step (e.g. typing a name). */
  mergeKey?: string;
}

export interface ViewModels {
  logical: LogicalModel;
  physical: PhysicalModel;
}

type Recipe<M> = (model: M) => M;

type Histories = { [V in ViewKind]: History<ViewModels[V]> };

export interface DocumentState {
  doc: ModelDocument;
  history: Histories;
  /** Model state at the start of a drag gesture, recorded as one undo step at its end. */
  gesture: Partial<ViewModels>;
  dirty: boolean;

  commit<V extends ViewKind>(view: V, recipe: Recipe<ViewModels[V]>, options?: CommitOptions): void;
  /** Applies a change without an undo step (intermediate states of a drag gesture). */
  commitTransient<V extends ViewKind>(view: V, recipe: Recipe<ViewModels[V]>): void;
  beginGesture(view: ViewKind): void;
  endGesture(view: ViewKind): void;
  undo(view: ViewKind): void;
  redo(view: ViewKind): void;
  setMeta(patch: Partial<ModelMeta>): void;
  setSettings(patch: Partial<ModelSettings>): void;
  /** Replaces the whole document (new/open/restore) and clears the undo history. */
  loadDocument(doc: ModelDocument, dirty?: boolean): void;
  markSaved(savedAt: string): void;
}

/** Keeps the generated foreign keys consistent after every change. */
function synchronize<V extends ViewKind>(view: V, model: ViewModels[V], convention: NamingConvention): ViewModels[V] {
  return (
    view === 'logical'
      ? syncLogicalForeignKeys(model as LogicalModel, convention)
      : syncPhysicalForeignKeys(model as PhysicalModel, convention)
  ) as ViewModels[V];
}

export const useDocumentStore = create<DocumentState>((set, get) => {
  function apply<V extends ViewKind>(view: V, recipe: Recipe<ViewModels[V]>, historyKey: string | null | false): void {
    const { doc, history } = get();
    const current = doc[view] as ViewModels[V];
    const changed = recipe(current);
    if (changed === current) return;
    const next = synchronize(view, changed, doc.settings.namingConvention);
    const viewHistory = history[view] as History<ViewModels[V]>;
    set({
      doc: { ...doc, [view]: next },
      history: historyKey === false ? history : { ...history, [view]: record(viewHistory, current, historyKey) },
      dirty: true,
    });
  }

  function step(view: ViewKind, direction: 'undo' | 'redo'): void {
    const { doc, history } = get();
    const viewHistory = history[view] as History<ViewModels[ViewKind]>;
    const result = direction === 'undo' ? undoStep(viewHistory, doc[view]) : redoStep(viewHistory, doc[view]);
    if (!result) return;
    set({ doc: { ...doc, [view]: result[1] }, history: { ...history, [view]: result[0] }, dirty: true });
  }

  return {
    doc: createEmptyDocument(),
    history: { logical: emptyHistory(), physical: emptyHistory() },
    gesture: {},
    dirty: false,

    commit: (view, recipe, options) => apply(view, recipe, options?.mergeKey ?? null),
    commitTransient: (view, recipe) => apply(view, recipe, false),

    beginGesture: (view) => set((s) => ({ gesture: { ...s.gesture, [view]: s.doc[view] } })),
    endGesture: (view) => {
      const { gesture, doc, history } = get();
      const start = gesture[view];
      if (!start) return;
      const rest = { ...gesture };
      delete rest[view];
      if (start === doc[view]) {
        set({ gesture: rest });
        return;
      }
      const viewHistory = history[view] as History<ViewModels[ViewKind]>;
      set({ gesture: rest, history: { ...history, [view]: record(viewHistory, start, null) } });
    },

    undo: (view) => step(view, 'undo'),
    redo: (view) => step(view, 'redo'),

    setMeta: (patch) => set((s) => ({ doc: { ...s.doc, meta: { ...s.doc.meta, ...patch } }, dirty: true })),
    setSettings: (patch) => {
      const { doc } = get();
      const settings = { ...doc.settings, ...patch };
      set({
        doc: {
          ...doc,
          settings,
          // Generated names depend on the naming convention.
          logical: syncLogicalForeignKeys(doc.logical, settings.namingConvention),
          physical: syncPhysicalForeignKeys(doc.physical, settings.namingConvention),
        },
        dirty: true,
      });
    },

    loadDocument: (doc, dirty = false) =>
      set({
        doc: {
          ...doc,
          logical: syncLogicalForeignKeys(doc.logical, doc.settings.namingConvention),
          physical: syncPhysicalForeignKeys(doc.physical, doc.settings.namingConvention),
        },
        history: { logical: emptyHistory(), physical: emptyHistory() },
        gesture: {},
        dirty,
      }),
    markSaved: (savedAt) => set((s) => ({ doc: { ...s.doc, meta: { ...s.doc.meta, savedAt } }, dirty: false })),
  };
});
