let context: CanvasRenderingContext2D | null | undefined;

/**
 * Measures the rendered width of a text in the given CSS font. Falls back to an
 * estimate where no canvas is available (unit tests).
 */
export function measureText(text: string, font: string): number {
  if (context === undefined) {
    context = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  }
  if (!context) return text.length * 7;
  context.font = font;
  return context.measureText(text).width;
}
