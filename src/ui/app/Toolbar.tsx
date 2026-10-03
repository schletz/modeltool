import { useReactFlow } from '@xyflow/react';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';
import { useLanguageStore, useT } from '../i18n/language';
import { newDocument, openDocument, saveDocument } from '../commands/fileCommands';
import { exportSql } from '../commands/exportCommands';
import { startTransformation } from '../commands/transformCommands';
import { autoArrange } from '../commands/layoutCommands';
import { createNodeAt, createNoteAt, redo, undo } from '../commands/editCommands';
import { GRID_SIZE } from '../diagram/geometry/diagramMetrics';

/** Position in the middle of the visible canvas area, snapped to the grid. */
function useViewportCenter() {
  const { screenToFlowPosition } = useReactFlow();
  return () => {
    const canvas = document.querySelector('.diagram-canvas')?.getBoundingClientRect();
    const p = screenToFlowPosition({
      x: canvas ? canvas.left + canvas.width / 2 : window.innerWidth / 2,
      y: canvas ? canvas.top + canvas.height / 3 : window.innerHeight / 3,
    });
    return { x: Math.round(p.x / GRID_SIZE) * GRID_SIZE, y: Math.round(p.y / GRID_SIZE) * GRID_SIZE };
  };
}

/** Main toolbar: file, view tabs, drawing tools, transformation, export, settings. */
export function Toolbar() {
  const t = useT();
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  const connectMode = useUiStore((s) => s.connectMode);
  const setConnectMode = useUiStore((s) => s.setConnectMode);
  const showGrid = useUiStore((s) => s.showGrid);
  const toggleGrid = useUiStore((s) => s.toggleGrid);
  const openDialog = useUiStore((s) => s.openDialog);
  const canUndo = useDocumentStore((s) => s.history[view].past.length > 0);
  const canRedo = useDocumentStore((s) => s.history[view].future.length > 0);
  const dirty = useDocumentStore((s) => s.dirty);
  const modelName = useDocumentStore((s) => s.doc.meta.modelName);
  const { language, setLanguage } = useLanguageStore();
  const { fitView } = useReactFlow();
  const center = useViewportCenter();

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <span className="app-title" title={t('app.title')}>
          ER
        </span>
        <button onClick={newDocument}>{t('file.new')}</button>
        <button onClick={() => void openDocument()} title="Ctrl+O">
          {t('file.open')}
        </button>
        <button onClick={() => void saveDocument()} title="Ctrl+S" data-testid="save">
          {t('file.save')}
          {dirty ? ' •' : ''}
        </button>
        <button onClick={() => void saveDocument(true)}>{t('file.saveAs')}</button>
      </div>

      <nav className="view-tabs" role="tablist">
        {(['logical', 'physical'] as const).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'tab active' : 'tab'} onClick={() => setView(v)} data-testid={`tab-${v}`}>
            {t(`view.${v}`)}
          </button>
        ))}
      </nav>

      <div className="toolbar-group">
        <button onClick={() => createNodeAt(center())} title={`${t(view === 'logical' ? 'tool.entity' : 'tool.table')} (E)`}>
          + {t(view === 'logical' ? 'tool.entity' : 'tool.table')}
        </button>
        <button onClick={() => createNoteAt(center())}>+ {t('tool.note')}</button>
        {view === 'logical' && (
          <div className="segmented" role="radiogroup" aria-label={t('tool.connectMode')}>
            {(['relationship', 'generalization'] as const).map((mode) => (
              <button
                key={mode}
                role="radio"
                aria-checked={connectMode === mode}
                className={connectMode === mode ? 'active' : ''}
                onClick={() => setConnectMode(mode)}
                title={t(`tool.${mode}Hint`)}
              >
                {t(`tool.${mode}`)}
              </button>
            ))}
          </div>
        )}
        <button onClick={undo} disabled={!canUndo} title="Ctrl+Z" aria-label={t('edit.undo')}>
          ↶
        </button>
        <button onClick={redo} disabled={!canRedo} title="Ctrl+Y" aria-label={t('edit.redo')}>
          ↷
        </button>
      </div>

      <div className="toolbar-group">
        {view === 'logical' && (
          <button className="primary" onClick={startTransformation} data-testid="transform">
            {t('transform.button')}
          </button>
        )}
        <button onClick={() => void autoArrange().then(() => fitView({ duration: 300 }))}>{t('layout.auto')}</button>
        <button onClick={() => void fitView({ duration: 300 })}>{t('layout.fit')}</button>
        <label className="toggle">
          <input type="checkbox" checked={showGrid} onChange={toggleGrid} />
          {t('layout.grid')}
        </label>
      </div>

      <div className="toolbar-group">
        <button onClick={exportSql} data-testid="export-sql">
          SQL
        </button>
        <button onClick={() => openDialog('pdf')} data-testid="export-pdf">
          PDF
        </button>
        <button onClick={() => openDialog('settings')} data-testid="settings">
          {t('settings.button')}
        </button>
        <select value={language} onChange={(e) => setLanguage(e.target.value as 'de' | 'en')} aria-label={t('settings.language')}>
          <option value="de">DE</option>
          <option value="en">EN</option>
        </select>
        <span className="model-name" title={modelName}>
          {modelName}
        </span>
      </div>
    </header>
  );
}
