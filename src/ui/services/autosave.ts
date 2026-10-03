import type { ModelDocument } from '../../domain/model/document';
import { parseDocument, serializeDocument } from '../../domain/serialization/documentSerializer';

const STORAGE_KEY = 'er-modeltool.autosave';

export interface AutosaveEntry {
  document: ModelDocument;
  /** ISO timestamp of the autosave. */
  savedAt: string;
}

/** Writes the current state to localStorage. Failures (quota, privacy mode) are ignored. */
export function writeAutosave(doc: ModelDocument): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), document: serializeDocument(doc) }));
  } catch {
    // Autosave is best effort.
  }
}

/** Reads the autosave; returns null if there is none or it is unreadable. */
export function readAutosave(): AutosaveEntry | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as { savedAt?: unknown; document?: unknown };
    if (typeof stored.savedAt !== 'string' || typeof stored.document !== 'string') return null;
    const parsed = parseDocument(stored.document);
    return parsed.ok ? { document: parsed.document, savedAt: stored.savedAt } : null;
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** True if the document contains anything worth restoring. */
export function isEmptyDocument(doc: ModelDocument): boolean {
  return doc.logical.entities.length === 0 && doc.logical.notes.length === 0 && doc.physical.tables.length === 0;
}
