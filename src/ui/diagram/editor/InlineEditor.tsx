import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { Id } from '../../../domain/model/common';
import { useUiStore, type EditorFocus } from '../../store/uiStore';
import { DataTypeInput } from './DataTypeInput';

/** One property column of the editor (name, PK, optional, data type, ...). */
export interface EditorField {
  label: string;
  kind: 'text' | 'toggle' | 'dataType';
  title?: string;
}

/** One editable line (attribute or column) in display order. */
export interface EditorRow {
  id: Id;
  values: (string | boolean)[];
  /** Per field: true if it cannot be changed (e.g. the key flag of a generated FK). */
  disabled: boolean[];
  deletable: boolean;
  isKey: boolean;
}

export interface InlineEditorProps {
  title: string;
  titlePlaceholder: string;
  fields: EditorField[];
  rows: EditorRow[];
  /** Read-only lines shown on top of the key block (inherited supertype key). */
  staticRows?: ReactNode;
  onTitleChange(value: string): void;
  onChange(rowId: Id, field: number, value: string | boolean): void;
  /** Inserts a new row after `afterRowId` (null = first) and returns its id. */
  onAddRow(afterRowId: Id | null): Id;
  onDeleteRow(rowId: Id): void;
  /** Called when the user tries to delete a row that is not deletable. */
  onDeleteRejected(): void;
  onMoveRow(rowId: Id, direction: -1 | 1): void;
  onClose(): void;
}

const cellKey = (rowId: string, field: number) => `${rowId}:${field}`;

/**
 * Keyboard driven editor for an entity or table (spec 3.2): Enter adds a row, Tab moves
 * between the properties of a row, arrow keys between rows, Alt+arrows move a row,
 * Ctrl+Backspace (empty name) / Ctrl+Delete delete it, Escape closes the editor.
 */
export function InlineEditor(props: InlineEditorProps) {
  const { fields, rows } = props;
  const focus = useUiStore((s) => s.editing?.focus ?? { rowId: 'title', field: 0 });
  const setFocus = useUiStore((s) => s.setEditorFocus);
  const cells = useRef(new Map<string, HTMLInputElement>());

  // Move the DOM focus to the focused cell whenever it (or the row order) changes.
  useEffect(() => {
    const element = cells.current.get(cellKey(focus.rowId, focus.field));
    if (element && document.activeElement !== element) {
      element.focus();
      if (element.type === 'text') element.setSelectionRange(element.value.length, element.value.length);
    }
  }, [focus.rowId, focus.field, rows]);

  const register = (rowId: string, field: number) => (el: HTMLInputElement | null) => {
    if (el) cells.current.set(cellKey(rowId, field), el);
    else cells.current.delete(cellKey(rowId, field));
  };

  const rowIndex = focus.rowId === 'title' ? -1 : rows.findIndex((r) => r.id === focus.rowId);
  const enabledFields = (index: number): number[] => {
    if (index < 0) return [0];
    const row = rows[index];
    return row ? fields.map((_, f) => f).filter((f) => !row.disabled[f]) : [0];
  };
  const focusAt = (index: number, field: number): void => {
    if (index < 0) {
      setFocus({ rowId: 'title', field: 0 });
      return;
    }
    const row = rows[index];
    if (!row) return;
    const allowed = enabledFields(index);
    setFocus({ rowId: row.id, field: allowed.includes(field) ? field : (allowed[0] ?? 0) } as EditorFocus);
  };

  const moveField = (direction: 1 | -1): void => {
    const allowed = enabledFields(rowIndex);
    const position = allowed.indexOf(focus.field) + direction;
    if (position >= 0 && position < allowed.length) {
      focusAt(rowIndex, allowed[position] as number);
      return;
    }
    const nextIndex = rowIndex + direction;
    if (nextIndex < -1 || nextIndex >= rows.length) return;
    const nextAllowed = enabledFields(nextIndex);
    focusAt(nextIndex, (direction === 1 ? nextAllowed[0] : nextAllowed[nextAllowed.length - 1]) ?? 0);
  };

  const deleteCurrentRow = (): void => {
    const row = rows[rowIndex];
    if (!row) return;
    if (!row.deletable) {
      props.onDeleteRejected();
      return;
    }
    props.onDeleteRow(row.id);
    focusAt(rowIndex - 1, 0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const row = rows[rowIndex];
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        props.onClose();
        break;
      case 'Enter': {
        e.preventDefault();
        const id = props.onAddRow(row ? row.id : null);
        setFocus({ rowId: id, field: 0 });
        break;
      }
      case 'Tab':
        e.preventDefault();
        moveField(e.shiftKey ? -1 : 1);
        break;
      case 'ArrowUp':
      case 'ArrowDown': {
        e.preventDefault();
        const direction = e.key === 'ArrowUp' ? -1 : 1;
        if (e.altKey) {
          if (row) props.onMoveRow(row.id, direction);
        } else {
          const target = rowIndex + direction;
          if (target >= -1 && target < rows.length) focusAt(target, focus.field);
        }
        break;
      }
      case 'Backspace':
        if ((e.ctrlKey || e.metaKey) && row && row.values[0] === '') {
          e.preventDefault();
          deleteCurrentRow();
        }
        break;
      case 'Delete':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          deleteCurrentRow();
        }
        break;
    }
  };

  const renderCell = (row: EditorRow, field: number) => {
    const def = fields[field] as EditorField;
    const value = row.values[field];
    const common = {
      ref: register(row.id, field),
      disabled: row.disabled[field] ?? false,
      onFocus: () => setFocus({ rowId: row.id, field }),
      className: `editor-cell ${def.kind} nodrag`,
      'aria-label': def.title ?? def.label,
    };
    if (def.kind === 'toggle') {
      return (
        <input
          key={field}
          type="checkbox"
          checked={value === true}
          onChange={(e) => props.onChange(row.id, field, e.target.checked)}
          {...common}
        />
      );
    }
    if (def.kind === 'dataType') {
      return (
        <DataTypeInput key={field} value={String(value ?? '')} onChange={(v) => props.onChange(row.id, field, v)} {...common} />
      );
    }
    return (
      <input
        key={field}
        type="text"
        value={String(value ?? '')}
        spellCheck={false}
        onChange={(e) => props.onChange(row.id, field, e.target.value)}
        {...common}
      />
    );
  };

  const gridTemplate = fields.map((f) => (f.kind === 'toggle' ? '28px' : f.kind === 'dataType' ? '150px' : '1fr')).join(' ');
  const keyRows = rows.filter((r) => r.isKey);
  const otherRows = rows.filter((r) => !r.isKey);
  const renderRow = (row: EditorRow) => (
    <div key={row.id} className="editor-row" style={{ gridTemplateColumns: gridTemplate }} data-row-id={row.id}>
      {fields.map((_, f) => renderCell(row, f))}
    </div>
  );

  return (
    <div className="inline-editor nowheel" onKeyDown={onKeyDown} data-testid="inline-editor">
      <input
        ref={register('title', 0)}
        className="editor-title nodrag"
        value={props.title}
        placeholder={props.titlePlaceholder}
        spellCheck={false}
        onFocus={() => setFocus({ rowId: 'title', field: 0 })}
        onChange={(e) => props.onTitleChange(e.target.value)}
        aria-label={props.titlePlaceholder}
      />
      <div className="editor-header" style={{ gridTemplateColumns: gridTemplate }}>
        {fields.map((f) => (
          <span key={f.label} title={f.title}>
            {f.label}
          </span>
        ))}
      </div>
      <div className="key-block">
        {props.staticRows}
        {keyRows.map(renderRow)}
      </div>
      <div className="other-block">{otherRows.map(renderRow)}</div>
    </div>
  );
}
