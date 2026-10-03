import type { Id, Point } from '../../domain/model/common';
import { addEntity, addSubtype, deleteEntity, deleteGeneralization, removeSubtype } from '../../domain/operations/logicalOperations';
import { addTable, deleteTable } from '../../domain/operations/physicalOperations';
import { addNote, deleteNote } from '../../domain/operations/noteOperations';
import { addRelationship, deleteRelationship } from '../../domain/operations/relationshipOperations';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';

const docStore = () => useDocumentStore.getState();
const uiStore = () => useUiStore.getState();

/** Creates an entity (logical) or table (physical) and opens the name editor. */
export function createNodeAt(position: Point): void {
  const view = uiStore().view;
  let id: Id = '';
  if (view === 'logical') {
    docStore().commit('logical', (m) => {
      const [next, newId] = addEntity(m, position);
      id = newId;
      return next;
    });
  } else {
    docStore().commit('physical', (m) => {
      const [next, newId] = addTable(m, position);
      id = newId;
      return next;
    });
  }
  uiStore().startEditing(id);
}

export function createNoteAt(position: Point): void {
  const view = uiStore().view;
  let id: Id = '';
  docStore().commit(view, (m) => {
    const [next, newId] = addNote(m, position);
    id = newId;
    return next;
  });
  uiStore().startEditing(id);
}

/**
 * Connects two nodes after a drag. In the logical view the connect mode decides between
 * a relationship and a generalization (source = supertype).
 */
export function connectNodes(sourceId: Id, targetId: Id): void {
  const { view, connectMode } = uiStore();
  if (view === 'logical' && connectMode === 'generalization') {
    const result = addSubtype(docStore().doc.logical, sourceId, targetId);
    if (!result.ok) {
      uiStore().showToast(`generalization.error.${result.error}`, 'error');
      return;
    }
    docStore().commit('logical', () => result.model);
    uiStore().select({ kind: 'node', id: result.generalizationId });
    return;
  }
  let relId: Id = '';
  docStore().commit(view, (m) => {
    const [next, id] = addRelationship(m, sourceId, targetId);
    relId = id;
    return next;
  });
  uiStore().select({ kind: 'edge', id: relId });
}

/** Deletes the selected element (entity with relationships, relationship with generated FKs, ...). */
export function deleteSelection(): void {
  const { selection, view } = uiStore();
  if (!selection) return;
  const { doc, commit } = docStore();
  const id = selection.id;
  if (view === 'logical') {
    const m = doc.logical;
    if (m.entities.some((e) => e.id === id)) commit('logical', (x) => deleteEntity(x, id));
    else if (m.relationships.some((r) => r.id === id)) commit('logical', (x) => deleteRelationship(x, id));
    else if (m.generalizations.some((g) => g.id === id)) commit('logical', (x) => deleteGeneralization(x, id));
    else if (m.notes.some((n) => n.id === id)) commit('logical', (x) => deleteNote(x, id));
    else deleteGeneralizationLine(id);
  } else {
    const m = doc.physical;
    if (m.tables.some((t) => t.id === id)) commit('physical', (x) => deleteTable(x, id));
    else if (m.relationships.some((r) => r.id === id)) commit('physical', (x) => deleteRelationship(x, id));
    else if (m.notes.some((n) => n.id === id)) commit('physical', (x) => deleteNote(x, id));
  }
  uiStore().select(null);
  uiStore().stopEditing();
}

/** A selected line between circle and subtype removes that subtype; the supertype line removes the generalization. */
function deleteGeneralizationLine(edgeId: Id): void {
  const [generalizationId, role, subtypeId] = edgeId.split(':');
  if (!generalizationId) return;
  if (role === 'sub' && subtypeId) docStore().commit('logical', (x) => removeSubtype(x, generalizationId, subtypeId));
  else if (role === 'super') docStore().commit('logical', (x) => deleteGeneralization(x, generalizationId));
}

export function undo(): void {
  uiStore().stopEditing();
  docStore().undo(uiStore().view);
}

export function redo(): void {
  uiStore().stopEditing();
  docStore().redo(uiStore().view);
}
