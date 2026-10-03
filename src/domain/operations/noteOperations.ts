import type { Id, Note, Point } from '../model/common';
import { newId } from '../ids';
import { patchById } from './memberList';

/** Any model that holds notes (logical or physical). */
export interface WithNotes {
  notes: Note[];
}

export function addNote<M extends WithNotes>(model: M, position: Point): [M, Id] {
  const note: Note = { id: newId(), text: '', position, width: 200, height: 96 };
  return [{ ...model, notes: [...model.notes, note] }, note.id];
}

export function updateNote<M extends WithNotes>(model: M, id: Id, patch: Partial<Omit<Note, 'id'>>): M {
  return { ...model, notes: patchById(model.notes, id, patch) };
}

export function moveNotes<M extends WithNotes>(model: M, positions: ReadonlyMap<Id, Point>): M {
  return {
    ...model,
    notes: model.notes.map((n) => {
      const p = positions.get(n.id);
      return p ? { ...n, position: p } : n;
    }),
  };
}

export function deleteNote<M extends WithNotes>(model: M, id: Id): M {
  return { ...model, notes: model.notes.filter((n) => n.id !== id) };
}
