import { create } from 'zustand';
import type { Id } from '../../domain/model/common';
import type { ViewKind } from '../../domain/model/document';
import type { ValidationIssue } from '../../domain/validation/issues';
import type { MessageKey } from '../i18n/messages';

export type Selection = { kind: 'node' | 'edge'; id: Id };

/** Focused cell of the inline editor: the title or (row id, field index). */
export type EditorFocus = { rowId: 'title'; field: 0 } | { rowId: Id; field: number };

export interface EditingState {
  nodeId: Id;
  focus: EditorFocus;
}

export type DialogKind = 'transform' | 'settings' | 'pdf';

export type ConnectMode = 'relationship' | 'generalization';

export interface Toast {
  id: number;
  message: MessageKey;
  params?: Record<string, string>;
  kind: 'info' | 'error';
}

export interface IssueList {
  issues: ValidationIssue[];
  context: 'transform' | 'export';
}

interface UiState {
  view: ViewKind;
  selection: Selection | null;
  editing: EditingState | null;
  showGrid: boolean;
  connectMode: ConnectMode;
  dialog: DialogKind | null;
  issueList: IssueList | null;
  toast: Toast | null;
  /** Request to center the viewport on a node (consumed by the canvas). */
  focusRequest: { id: Id; seq: number } | null;

  setView(view: ViewKind): void;
  select(selection: Selection | null): void;
  startEditing(nodeId: Id, focus?: EditorFocus): void;
  setEditorFocus(focus: EditorFocus): void;
  stopEditing(): void;
  toggleGrid(): void;
  setConnectMode(mode: ConnectMode): void;
  openDialog(dialog: DialogKind | null): void;
  showIssues(list: IssueList | null): void;
  showToast(message: MessageKey, kind?: Toast['kind'], params?: Record<string, string>): void;
  dismissToast(): void;
  requestFocus(id: Id): void;
}

let toastSeq = 0;
let focusSeq = 0;

export const useUiStore = create<UiState>((set) => ({
  view: 'logical',
  selection: null,
  editing: null,
  showGrid: true,
  connectMode: 'relationship',
  dialog: null,
  issueList: null,
  toast: null,
  focusRequest: null,

  setView: (view) => set({ view, selection: null, editing: null }),
  select: (selection) => set({ selection }),
  startEditing: (nodeId, focus = { rowId: 'title', field: 0 }) =>
    set({ editing: { nodeId, focus }, selection: { kind: 'node', id: nodeId } }),
  setEditorFocus: (focus) => set((s) => (s.editing ? { editing: { ...s.editing, focus } } : {})),
  stopEditing: () => set({ editing: null }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  setConnectMode: (connectMode) => set({ connectMode }),
  openDialog: (dialog) => set({ dialog }),
  showIssues: (issueList) => set({ issueList }),
  showToast: (message, kind = 'info', params) => set({ toast: { id: ++toastSeq, message, kind, params } }),
  dismissToast: () => set({ toast: null }),
  requestFocus: (id) => set({ focusRequest: { id, seq: ++focusSeq } }),
}));
