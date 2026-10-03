import { memo, useEffect, useRef } from 'react';
import { NodeResizer, type Node, type NodeProps } from '@xyflow/react';
import type { Note } from '../../../domain/model/common';
import { updateNote } from '../../../domain/operations/noteOperations';
import { useDocumentStore } from '../../store/documentStore';
import { useUiStore } from '../../store/uiStore';
import { useT } from '../../i18n/language';
import { GRID_SIZE } from '../geometry/diagramMetrics';

export type NoteNodeType = Node<{ note: Note }, 'note'>;

const snap = (v: number) => Math.max(GRID_SIZE * 2, Math.round(v / GRID_SIZE) * GRID_SIZE);

/** Free text note; double click edits the text, the frame resizes it. */
export const NoteNode = memo(function NoteNode({ data, selected }: NodeProps<NoteNodeType>) {
  const { note } = data;
  const t = useT();
  const view = useUiStore((s) => s.view);
  const editing = useUiStore((s) => s.editing?.nodeId === note.id);
  const stopEditing = useUiStore((s) => s.stopEditing);
  const { commit, commitTransient, beginGesture, endGesture } = useDocumentStore.getState();
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textRef.current?.focus();
  }, [editing]);

  return (
    <div className={`note-node${selected ? ' selected' : ''}`} data-testid="note-node">
      <NodeResizer
        isVisible={selected}
        minWidth={GRID_SIZE * 4}
        minHeight={GRID_SIZE * 2}
        onResizeStart={() => beginGesture(view)}
        onResize={(_, p) =>
          commitTransient(view, (m) =>
            updateNote(m, note.id, { position: { x: p.x, y: p.y }, width: snap(p.width), height: snap(p.height) }),
          )
        }
        onResizeEnd={() => endGesture(view)}
      />
      {editing ? (
        <textarea
          ref={textRef}
          className="note-text nodrag nowheel"
          value={note.text}
          placeholder={t('note.placeholder')}
          onChange={(e) => commit(view, (m) => updateNote(m, note.id, { text: e.target.value }), { mergeKey: `note:${note.id}` })}
          onKeyDown={(e) => {
            if (e.key === 'Escape') stopEditing();
          }}
          onBlur={stopEditing}
        />
      ) : (
        <div className="note-text">{note.text || <span className="placeholder">{t('note.placeholder')}</span>}</div>
      )}
    </div>
  );
});
