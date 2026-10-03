import type { LogicalModel } from '../../../domain/model/logical';
import type { Rect } from '../../../domain/routing/geometry';
import type { Scene, SceneNode } from '../../diagram/scene/buildScene';
import { cardinalityShapes, sideRotation } from '../../diagram/symbols/crowFootShapes';
import { entityRows, keyLabel, tableRows } from '../../diagram/geometry/displayRows';
import { tableColumnLayout } from '../../diagram/geometry/nodeGeometry';
import { measureText } from '../../diagram/geometry/textMeasure';
import {
  BODY_PADDING,
  CELL_PADDING,
  GENERALIZATION_RADIUS,
  GENERALIZATION_SIZE,
  HEADER_HEIGHT,
  KEY_COLUMN_WIDTH,
  NAME_FONT,
  ROW_HEIGHT,
} from '../../diagram/geometry/diagramMetrics';

const SVG_NS = 'http://www.w3.org/2000/svg';
const FONT = 'helvetica';
// svg2pdf keeps the font weight of the previous text, so every text states it explicitly.
const NORMAL = { 'font-family': FONT, 'font-weight': 'normal' };
const MARGIN = 16;

type Attrs = Record<string, string | number>;

function el(name: string, attrs: Attrs, parent: Element, text?: string): SVGElement {
  const element = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) element.setAttribute(k, String(v));
  if (text !== undefined) element.textContent = text;
  parent.appendChild(element);
  return element;
}

/** One displayed line of a node in the export. */
interface ExportRow {
  key: string;
  name: string;
  type?: string;
  flags: string;
  greyed?: boolean;
}

/** Bounding box of all nodes and routes of a scene. */
export function sceneBounds(scene: Scene): Rect {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const n of scene.nodes) {
    xs.push(n.rect.x, n.rect.x + n.rect.width);
    ys.push(n.rect.y, n.rect.y + n.rect.height);
  }
  for (const r of scene.routes.values()) {
    for (const p of r.points) {
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  if (xs.length === 0) return { x: 0, y: 0, width: 100, height: 100 };
  const x = Math.min(...xs) - MARGIN;
  const y = Math.min(...ys) - MARGIN;
  return { x, y, width: Math.max(...xs) + MARGIN - x, height: Math.max(...ys) + MARGIN - y };
}

/**
 * Renders a scene as a standalone SVG for the PDF export: same geometry as the canvas,
 * but without grid, selection and UI elements.
 */
export function buildDiagramSvg(scene: Scene, logical: LogicalModel): SVGSVGElement {
  const bounds = sceneBounds(scene);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
  svg.setAttribute('width', String(bounds.width));
  svg.setAttribute('height', String(bounds.height));

  for (const n of scene.nodes.filter((x) => x.kind === 'note')) drawNode(svg, n, logical);
  drawEdges(svg, scene);
  for (const n of scene.nodes.filter((x) => x.kind !== 'note')) drawNode(svg, n, logical);
  return svg;
}

function drawEdges(svg: SVGSVGElement, scene: Scene): void {
  for (const edge of scene.edges) {
    const route = scene.routes.get(edge.id);
    if (!route) continue;
    const dashed = edge.kind === 'relationship' && !edge.relationship.isIdentifying;
    el('polyline', {
      points: route.points.map((p) => `${p.x},${p.y}`).join(' '),
      fill: 'none',
      stroke: '#222',
      'stroke-width': 1.2,
      ...(dashed ? { 'stroke-dasharray': '6 4' } : {}),
    }, svg);
    if (edge.kind !== 'relationship') continue;
    const ends = [
      { port: route.source, cardinality: edge.relationship.sourceCardinality },
      { port: route.target, cardinality: edge.relationship.targetCardinality },
    ];
    for (const { port, cardinality } of ends) {
      const group = el('g', { transform: `translate(${port.point.x} ${port.point.y}) rotate(${sideRotation(port.side)})` }, svg);
      for (const s of cardinalityShapes(cardinality)) {
        if (s.type === 'line') el('line', { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, stroke: '#222', 'stroke-width': 1.2 }, group);
        else el('circle', { cx: s.cx, cy: s.cy, r: s.r, fill: '#fff', stroke: '#222', 'stroke-width': 1.2 }, group);
      }
    }
  }
}

function drawNode(svg: SVGSVGElement, node: SceneNode, logical: LogicalModel): void {
  const { x, y, width, height } = node.rect;
  switch (node.kind) {
    case 'note':
      el('rect', { x, y, width, height, fill: '#fff8c4', stroke: '#c9b44a', 'stroke-width': 1 }, svg);
      wrapText(node.note.text, width - 2 * CELL_PADDING).forEach((line, i) =>
        el('text', { x: x + CELL_PADDING, y: y + 18 + i * 16, ...NORMAL, 'font-size': 12, fill: '#333' }, svg, line),
      );
      return;
    case 'generalization': {
      const cx = x + GENERALIZATION_SIZE.width / 2;
      const r = GENERALIZATION_RADIUS;
      const barY = y + 2 * r + 5;
      el('circle', { cx, cy: y + r + 1, r, fill: '#fff', stroke: '#222', 'stroke-width': 1.2 }, svg);
      el('line', { x1: cx - r - 1, x2: cx + r + 1, y1: barY, y2: barY, stroke: '#222', 'stroke-width': 1.2 }, svg);
      if (node.generalization.isComplete) {
        el('line', { x1: cx - r - 1, x2: cx + r + 1, y1: barY + 4, y2: barY + 4, stroke: '#222', 'stroke-width': 1.2 }, svg);
      }
      return;
    }
    case 'entity': {
      const { keyRows, otherRows } = entityRows(logical, node.entity);
      const toRow = (r: (typeof keyRows)[number]): ExportRow => ({
        key: r.keyLabel,
        name: r.name,
        flags: r.isOptional ? 'o' : '*',
        greyed: r.isInherited,
      });
      drawBox(svg, node.rect, node.entity.name, keyRows.map(toRow), otherRows.map(toRow), undefined);
      return;
    }
    case 'table': {
      const { keyRows, otherRows } = tableRows(node.table);
      const toRow = (c: (typeof keyRows)[number]): ExportRow => ({
        key: keyLabel(c.isPrimaryKey, c.fk !== undefined),
        name: c.name,
        type: c.dataType || '?',
        flags: [c.isNotNull ? 'NN' : '', c.isUnique ? 'U' : '', c.isIdentity ? 'ID' : ''].filter(Boolean).join(' '),
      });
      const typeX = x + CELL_PADDING * 2 + KEY_COLUMN_WIDTH + tableColumnLayout(node.table).nameWidth;
      drawBox(svg, node.rect, node.table.name, keyRows.map(toRow), otherRows.map(toRow), typeX);
      return;
    }
  }
}

function drawBox(svg: SVGSVGElement, rect: Rect, title: string, keyRows: ExportRow[], otherRows: ExportRow[], typeX: number | undefined): void {
  const { x, y, width, height } = rect;
  el('rect', { x, y, width, height, fill: '#fff', stroke: '#222', 'stroke-width': 1.2 }, svg);
  el('rect', { x, y, width, height: HEADER_HEIGHT, fill: '#e8eef7', stroke: '#222', 'stroke-width': 1.2 }, svg);
  el('text', { x: x + CELL_PADDING, y: y + 18, 'font-family': FONT, 'font-size': 13, 'font-weight': 'bold', fill: '#111' }, svg, title || '?');

  const rows = [...keyRows, ...otherRows];
  rows.forEach((row, i) => {
    const baseline = y + HEADER_HEIGHT + BODY_PADDING + i * ROW_HEIGHT + 15;
    const fill = row.greyed ? '#999' : '#111';
    if (row.key) el('text', { x: x + CELL_PADDING, y: baseline, 'font-family': FONT, 'font-size': 10, 'font-weight': 'bold', fill }, svg, row.key);
    el('text', { x: x + CELL_PADDING + KEY_COLUMN_WIDTH, y: baseline, ...NORMAL, 'font-size': 13, fill }, svg, row.name);
    if (row.type !== undefined && typeX !== undefined) {
      el('text', { x: typeX + CELL_PADDING, y: baseline, ...NORMAL, 'font-size': 13, fill: row.type === '?' ? '#c00' : '#333' }, svg, row.type);
    }
    el('text', { x: x + width - CELL_PADDING, y: baseline, ...NORMAL, 'font-size': 10, 'text-anchor': 'end', fill: '#555' }, svg, row.flags);
  });
  if (keyRows.length > 0 && otherRows.length > 0) {
    const lineY = y + HEADER_HEIGHT + BODY_PADDING + keyRows.length * ROW_HEIGHT;
    el('line', { x1: x, x2: x + width, y1: lineY, y2: lineY, stroke: '#222', 'stroke-width': 0.8 }, svg);
  }
}

/** Splits note text into lines that fit the note width. */
function wrapText(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measureText(candidate, NAME_FONT) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}
