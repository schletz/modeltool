import { useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useUiStore } from '../store/uiStore';
import { createNodeAt, deleteSelection, redo, undo } from '../commands/editCommands';
import { openDocument, saveDocument } from '../commands/fileCommands';
import { pointerTracker } from '../diagram/pointerTracker';
import { GRID_SIZE } from '../diagram/geometry/diagramMetrics';

/** True while the user types into a field outside the inline editor (dialogs, notes, panels). */
function isTypingOutsideEditor(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  // Checkboxes and buttons keep the focus after a click but do not consume keys.
  const textInput = target instanceof HTMLInputElement && !['checkbox', 'radio', 'button'].includes(target.type);
  const typing = target.isContentEditable || textInput || target.tagName === 'TEXTAREA';
  return typing && !target.closest('.inline-editor');
}

function isInEditor(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('.inline-editor') !== null;
}

/** Global shortcuts: Ctrl+S/O/Z/Y, Delete, E (new entity), Escape (deselect). */
export function useKeyboardShortcuts(): void {
  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (ctrl && key === 's') {
        e.preventDefault();
        void saveDocument(e.shiftKey);
        return;
      }
      if (ctrl && key === 'o') {
        e.preventDefault();
        void openDocument();
        return;
      }
      if (isTypingOutsideEditor(e.target) || useUiStore.getState().dialog) return;
      if (ctrl && (key === 'z' || key === 'y')) {
        e.preventDefault();
        if (key === 'y' || e.shiftKey) redo();
        else undo();
        return;
      }
      // Remaining shortcuts must not interfere with typing in the inline editor.
      if (isInEditor(e.target) || ctrl || e.altKey) return;
      if (e.key === 'Delete') {
        e.preventDefault();
        deleteSelection();
      } else if (key === 'e') {
        e.preventDefault();
        const p = pointerTracker.get() ?? screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
        createNodeAt({ x: Math.round(p.x / GRID_SIZE) * GRID_SIZE, y: Math.round(p.y / GRID_SIZE) * GRID_SIZE });
      } else if (e.key === 'Escape') {
        useUiStore.getState().select(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screenToFlowPosition]);
}
