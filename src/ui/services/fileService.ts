/** Minimal typing of the File System Access API (Chromium only, not in lib.dom). */
interface FileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string | Blob): Promise<void>; close(): Promise<void> }>;
}

interface PickerType {
  description: string;
  accept: Record<string, string[]>;
}

interface FileSystemAccessWindow {
  showOpenFilePicker?(options: { types: PickerType[]; multiple?: boolean }): Promise<FileHandle[]>;
  showSaveFilePicker?(options: { suggestedName: string; types: PickerType[] }): Promise<FileHandle>;
}

export type { FileHandle };

const JSON_TYPE: PickerType = { description: 'ER-Modeltool JSON', accept: { 'application/json': ['.json'] } };

const fsWindow = window as unknown as FileSystemAccessWindow;

/** True if the File System Access API is available (Chromium) and not running from file://. */
export function hasFileSystemAccess(): boolean {
  return typeof fsWindow.showOpenFilePicker === 'function' && typeof fsWindow.showSaveFilePicker === 'function';
}

export interface OpenedFile {
  text: string;
  name: string;
  handle: FileHandle | null;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Lets the user pick a JSON file. Returns null if cancelled. */
export async function openJsonFile(): Promise<OpenedFile | null> {
  if (hasFileSystemAccess()) {
    try {
      const [handle] = await fsWindow.showOpenFilePicker!({ types: [JSON_TYPE] });
      if (!handle) return null;
      const file = await handle.getFile();
      return { text: await file.text(), name: file.name, handle };
    } catch (error) {
      if (isAbort(error)) return null;
      throw error;
    }
  }
  return openWithInput();
}

/** Fallback: hidden `<input type="file">`. */
function openWithInput(): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      resolve(file ? { text: await file.text(), name: file.name, handle: null } : null);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/**
 * Saves text. With a handle it writes into that file; with `pickNew` (or without a handle)
 * the save dialog chooses a new file. Without the API the file is downloaded.
 * Returns the handle used (null for downloads) or undefined if cancelled.
 */
export async function saveJsonFile(text: string, suggestedName: string, handle: FileHandle | null, pickNew: boolean): Promise<FileHandle | null | undefined> {
  if (!hasFileSystemAccess()) {
    downloadText(text, suggestedName, 'application/json');
    return null;
  }
  try {
    const target = handle && !pickNew ? handle : await fsWindow.showSaveFilePicker!({ suggestedName, types: [JSON_TYPE] });
    const writable = await target.createWritable();
    await writable.write(text);
    await writable.close();
    return target;
  } catch (error) {
    if (isAbort(error)) return undefined;
    throw error;
  }
}

/** Triggers a browser download. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, fileName: string, mimeType: string): void {
  downloadBlob(new Blob([text], { type: `${mimeType};charset=utf-8` }), fileName);
}

/** File name derived from the model name, safe for all operating systems. */
export function fileNameFor(modelName: string, extension: string): string {
  const base = modelName.trim().replace(/[\\/:*?"<>|]+/g, '_') || 'model';
  return `${base}.${extension}`;
}
