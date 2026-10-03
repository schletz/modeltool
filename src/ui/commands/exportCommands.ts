import { hasPhysicalModel } from '../../domain/model/document';
import { validatePhysical } from '../../domain/validation/physicalValidation';
import { generateDdl } from '../../domain/ddl/generateDdl';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';
import { t } from '../i18n/language';
import { downloadBlob, downloadText, fileNameFor } from '../services/fileService';
import type { PdfOptions } from '../services/pdf/pdfExport';

/** Validates the physical model and downloads the DDL script; blockers are listed instead. */
export function exportSql(): void {
  const { doc } = useDocumentStore.getState();
  const ui = useUiStore.getState();
  if (!hasPhysicalModel(doc)) {
    ui.showToast('export.noPhysicalModel', 'error');
    return;
  }
  const issues = validatePhysical(doc.physical);
  if (issues.length > 0) {
    ui.showIssues({ issues, context: 'export' });
    return;
  }
  ui.showIssues(null);
  downloadText(generateDdl(doc.physical), fileNameFor(doc.meta.modelName, 'sql'), 'application/sql');
}

export async function exportPdf(options: PdfOptions): Promise<void> {
  const { doc } = useDocumentStore.getState();
  try {
    // jsPDF and svg2pdf are only loaded when needed.
    const { createPdf } = await import('../services/pdf/pdfExport');
    const blob = await createPdf(doc, options, {
      model: t('meta.modelName'),
      student: t('meta.studentName'),
      className: t('meta.className'),
      studentId: t('meta.studentId'),
      date: t('meta.date'),
      view: { logical: t('view.logical'), physical: t('view.physical') },
    });
    downloadBlob(blob, fileNameFor(doc.meta.modelName, 'pdf'));
  } catch {
    useUiStore.getState().showToast('export.pdfFailed', 'error');
  }
}
