import { createEmptyDocument } from '../../domain/model/document';
import { parseDocument, serializeDocument } from '../../domain/serialization/documentSerializer';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';
import { t } from '../i18n/language';
import { fileNameFor, openJsonFile, saveJsonFile, type FileHandle } from '../services/fileService';

/** Handle of the file the document was opened from or last saved to (Chromium only). */
let currentHandle: FileHandle | null = null;

/** Asks before unsaved changes would be lost. */
function confirmDiscard(): boolean {
  return !useDocumentStore.getState().dirty || window.confirm(t('file.confirmDiscard'));
}

function resetUi(): void {
  const ui = useUiStore.getState();
  ui.setView('logical');
  ui.showIssues(null);
}

export function newDocument(): void {
  if (!confirmDiscard()) return;
  currentHandle = null;
  useDocumentStore.getState().loadDocument(createEmptyDocument());
  resetUi();
}

/** Loads a document from JSON text; shows an understandable error for invalid files. */
export function loadFromText(text: string, handle: FileHandle | null = null): boolean {
  const result = parseDocument(text);
  if (!result.ok) {
    useUiStore.getState().showToast(`file.error.${result.error}`, 'error', { detail: result.detail ?? '' });
    return false;
  }
  currentHandle = handle;
  useDocumentStore.getState().loadDocument(result.document);
  resetUi();
  return true;
}

export async function openDocument(): Promise<void> {
  if (!confirmDiscard()) return;
  try {
    const file = await openJsonFile();
    if (file) loadFromText(file.text, file.handle);
  } catch {
    useUiStore.getState().showToast('file.error.read', 'error');
  }
}

/** Opens a file dropped onto the canvas. */
export async function openDroppedFile(file: File): Promise<void> {
  if (!confirmDiscard()) return;
  loadFromText(await file.text());
}

/** Saves into the opened file (Ctrl+S); "save as" or a missing handle asks for a new file. */
export async function saveDocument(saveAs = false): Promise<void> {
  const store = useDocumentStore.getState();
  const savedAt = new Date().toISOString();
  const doc = { ...store.doc, meta: { ...store.doc.meta, savedAt } };
  try {
    const handle = await saveJsonFile(serializeDocument(doc), fileNameFor(doc.meta.modelName, 'json'), currentHandle, saveAs);
    if (handle === undefined) return;
    currentHandle = handle;
    store.markSaved(savedAt);
    useUiStore.getState().showToast('file.saved');
  } catch {
    useUiStore.getState().showToast('file.error.write', 'error');
  }
}
