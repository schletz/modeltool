import type { Note } from '../../../domain/model/common';
import type { Entity, LogicalModel } from '../../../domain/model/logical';
import type { Table } from '../../../domain/model/physical';
import type { Rect } from '../../../domain/routing/geometry';
import { entityRows, tableRows, type RowBlocks } from './displayRows';
import {
  BODY_PADDING,
  CELL_PADDING,
  EDITOR_HEADER_HEIGHT,
  FLAG_COLUMN_WIDTH,
  GENERALIZATION_SIZE,
  HEADER_HEIGHT,
  KEY_COLUMN_WIDTH,
  LOGICAL_EDITOR_WIDTH,
  MIN_NODE_WIDTH,
  NAME_FONT,
  PHYSICAL_EDITOR_WIDTH,
  PHYSICAL_FLAGS_WIDTH,
  ROW_HEIGHT,
  TITLE_FONT,
} from './diagramMetrics';
import { measureText } from './textMeasure';

export interface Size {
  width: number;
  height: number;
}

/** Column widths inside a table node (physical), shared by node rendering and PDF export. */
export interface TableColumnLayout {
  nameWidth: number;
  typeWidth: number;
}

function bodyHeight(blocks: RowBlocks<unknown>): number {
  const rows = Math.max(1, blocks.keyRows.length + blocks.otherRows.length);
  return rows * ROW_HEIGHT + BODY_PADDING * 2;
}

function maxWidth(texts: string[], font: string): number {
  return texts.reduce((max, t) => Math.max(max, measureText(t, font)), 0);
}

export function entitySize(model: LogicalModel, entity: Entity, editing = false): Size {
  const blocks = entityRows(model, entity);
  const names = [...blocks.keyRows, ...blocks.otherRows].map((r) => r.name);
  const content = KEY_COLUMN_WIDTH + maxWidth(names, NAME_FONT) + FLAG_COLUMN_WIDTH + CELL_PADDING * 3;
  const title = measureText(entity.name || '?', TITLE_FONT) + CELL_PADDING * 2;
  const width = Math.ceil(Math.max(MIN_NODE_WIDTH, content, title, editing ? LOGICAL_EDITOR_WIDTH : 0));
  return { width, height: HEADER_HEIGHT + bodyHeight(blocks) + (editing ? EDITOR_HEADER_HEIGHT : 0) };
}

export function tableColumnLayout(table: Table): TableColumnLayout {
  return {
    nameWidth: Math.ceil(maxWidth(table.columns.map((c) => c.name), NAME_FONT)),
    typeWidth: Math.ceil(Math.max(16, maxWidth(table.columns.map((c) => c.dataType), NAME_FONT))),
  };
}

export function tableSize(table: Table, editing = false): Size {
  const { nameWidth, typeWidth } = tableColumnLayout(table);
  const content = KEY_COLUMN_WIDTH + nameWidth + typeWidth + PHYSICAL_FLAGS_WIDTH + CELL_PADDING * 4;
  const title = measureText(table.name || '?', TITLE_FONT) + CELL_PADDING * 2;
  const width = Math.ceil(Math.max(MIN_NODE_WIDTH, content, title, editing ? PHYSICAL_EDITOR_WIDTH : 0));
  return { width, height: HEADER_HEIGHT + bodyHeight(tableRows(table)) + (editing ? EDITOR_HEADER_HEIGHT : 0) };
}

export function noteRect(note: Note): Rect {
  return { ...note.position, width: note.width, height: note.height };
}

export const generalizationSize: Size = GENERALIZATION_SIZE;
