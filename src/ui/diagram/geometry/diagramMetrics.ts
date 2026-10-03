/**
 * Layout metrics shared by the canvas nodes, the edge routing and the PDF export,
 * so all three agree on node sizes. Arial is metric compatible with the PDF's Helvetica.
 */
export const DIAGRAM_FONT_FAMILY = 'Arial, Helvetica, sans-serif';
export const NAME_FONT = `13px ${DIAGRAM_FONT_FAMILY}`;
export const TITLE_FONT = `bold 13px ${DIAGRAM_FONT_FAMILY}`;
export const MARKER_FONT = `bold 10px ${DIAGRAM_FONT_FAMILY}`;

export const HEADER_HEIGHT = 28;
export const ROW_HEIGHT = 22;
export const BODY_PADDING = 4;
export const CELL_PADDING = 8;
export const KEY_COLUMN_WIDTH = 44;
export const FLAG_COLUMN_WIDTH = 18;
export const PHYSICAL_FLAGS_WIDTH = 64;
export const MIN_NODE_WIDTH = 140;
/** Column labels shown above the rows while the inline editor is open. */
export const EDITOR_HEADER_HEIGHT = 16;
export const LOGICAL_EDITOR_WIDTH = 340;
export const PHYSICAL_EDITOR_WIDTH = 620;

/** The category circle of a generalization including the bars below it. */
export const GENERALIZATION_SIZE = { width: 24, height: 32 } as const;
export const GENERALIZATION_RADIUS = 11;

export const GRID_SIZE = 16;
