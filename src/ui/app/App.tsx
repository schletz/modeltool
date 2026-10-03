import { useState, type DragEvent } from 'react';
import { useUiStore } from '../store/uiStore';
import { openDroppedFile } from '../commands/fileCommands';
import { readAutosave, isEmptyDocument, type AutosaveEntry } from '../services/autosave';
import { DiagramCanvas } from '../diagram/DiagramCanvas';
import { Toolbar } from './Toolbar';
import { TransformDialog } from './TransformDialog';
import { SettingsDialog } from './SettingsDialog';
import { PdfDialog } from './PdfDialog';
import { RestoreDialog } from './RestoreDialog';
import { IssuePanel } from './IssuePanel';
import { ToastView } from './ToastView';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { usePersistenceGuards } from './usePersistenceGuards';

function initialAutosave(): AutosaveEntry | null {
  const entry = readAutosave();
  return entry && !isEmptyDocument(entry.document) ? entry : null;
}

/** Application shell: toolbar, canvas, panels and dialogs. */
export function App() {
  const dialog = useUiStore((s) => s.dialog);
  const [pendingRestore, setPendingRestore] = useState(initialAutosave);
  useKeyboardShortcuts();
  usePersistenceGuards(pendingRestore === null);

  const onDrop = (e: DragEvent) => {
    const file = e.dataTransfer.files[0];
    if (!file || !file.name.toLowerCase().endsWith('.json')) return;
    e.preventDefault();
    void openDroppedFile(file);
  };

  return (
    <div className="app" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <Toolbar />
      <main className="workspace">
        <DiagramCanvas />
        <IssuePanel />
      </main>
      {dialog === 'transform' && <TransformDialog />}
      {dialog === 'settings' && <SettingsDialog />}
      {dialog === 'pdf' && <PdfDialog />}
      {pendingRestore && <RestoreDialog entry={pendingRestore} onDone={() => setPendingRestore(null)} />}
      <ToastView />
    </div>
  );
}
