import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import { hasPhysicalModel, type ModelDocument, type ViewKind } from '../../../domain/model/document';
import { buildScene } from '../../diagram/scene/buildScene';
import { buildDiagramSvg } from './diagramSvg';

export interface PdfOptions {
  format: 'a4' | 'a3';
  orientation: 'portrait' | 'landscape';
}

/** Labels for the page header, already translated by the caller. */
export interface PdfLabels {
  model: string;
  student: string;
  className: string;
  studentId: string;
  date: string;
  view: Record<ViewKind, string>;
}

const PAGE_MARGIN = 10;
const HEADER_HEIGHT = 12;

/**
 * Creates a vector PDF with one page per model (the physical one only if it exists),
 * each scaled to fit the page, with a header line of the metadata (spec 9.4).
 */
export async function createPdf(doc: ModelDocument, options: PdfOptions, labels: PdfLabels): Promise<Blob> {
  const pdf = new jsPDF({ format: options.format, orientation: options.orientation, unit: 'mm' });
  const views: ViewKind[] = hasPhysicalModel(doc) ? ['logical', 'physical'] : ['logical'];
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (const [index, view] of views.entries()) {
    if (index > 0) pdf.addPage(options.format, options.orientation);
    drawHeader(pdf, doc, labels, view, pageWidth);

    const scene = buildScene(doc, view, null);
    const svg = buildDiagramSvg(scene, doc.logical);
    // svg2pdf resolves styles of attached elements more reliably.
    svg.style.position = 'absolute';
    svg.style.left = '-100000px';
    document.body.appendChild(svg);
    try {
      const availableWidth = pageWidth - 2 * PAGE_MARGIN;
      const availableHeight = pageHeight - 2 * PAGE_MARGIN - HEADER_HEIGHT;
      const svgWidth = Number(svg.getAttribute('width'));
      const svgHeight = Number(svg.getAttribute('height'));
      const scale = Math.min(availableWidth / svgWidth, availableHeight / svgHeight);
      const width = svgWidth * scale;
      const height = svgHeight * scale;
      await pdf.svg(svg, {
        x: PAGE_MARGIN + (availableWidth - width) / 2,
        y: PAGE_MARGIN + HEADER_HEIGHT,
        width,
        height,
      });
    } finally {
      svg.remove();
    }
  }
  return pdf.output('blob');
}

function drawHeader(pdf: jsPDF, doc: ModelDocument, labels: PdfLabels, view: ViewKind, pageWidth: number): void {
  const { meta } = doc;
  const parts = [
    `${labels.model}: ${meta.modelName || '-'}`,
    `${labels.student}: ${meta.studentName || '-'}`,
    `${labels.className}: ${meta.className || '-'}`,
    ...(meta.studentId ? [`${labels.studentId}: ${meta.studentId}`] : []),
    `${labels.date}: ${new Date().toLocaleDateString()}`,
  ];
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(parts.join('   |   '), PAGE_MARGIN, PAGE_MARGIN + 4);
  pdf.setFont('helvetica', 'bold');
  pdf.text(labels.view[view], pageWidth - PAGE_MARGIN, PAGE_MARGIN + 4, { align: 'right' });
  pdf.setLineWidth(0.2);
  pdf.line(PAGE_MARGIN, PAGE_MARGIN + 7, pageWidth - PAGE_MARGIN, PAGE_MARGIN + 7);
}
