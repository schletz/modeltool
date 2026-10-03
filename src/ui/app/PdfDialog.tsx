import { useState } from 'react';
import { useUiStore } from '../store/uiStore';
import { useT } from '../i18n/language';
import { exportPdf } from '../commands/exportCommands';
import type { PdfOptions } from '../services/pdf/pdfExport';
import { Modal } from './Modal';

/** Paper format and orientation for the PDF export. */
export function PdfDialog() {
  const t = useT();
  const [options, setOptions] = useState<PdfOptions>({ format: 'a4', orientation: 'landscape' });
  const [busy, setBusy] = useState(false);
  const close = () => useUiStore.getState().openDialog(null);

  const run = async () => {
    setBusy(true);
    await exportPdf(options);
    setBusy(false);
    close();
  };

  return (
    <Modal
      title={t('pdf.title')}
      onClose={close}
      testId="pdf-dialog"
      actions={
        <>
          <button onClick={close}>{t('common.cancel')}</button>
          <button className="primary" disabled={busy} onClick={() => void run()} data-testid="pdf-confirm">
            {t('pdf.export')}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label>
          <span>{t('pdf.format')}</span>
          <select value={options.format} onChange={(e) => setOptions({ ...options, format: e.target.value as PdfOptions['format'] })}>
            <option value="a4">A4</option>
            <option value="a3">A3</option>
          </select>
        </label>
        <label>
          <span>{t('pdf.orientation')}</span>
          <select value={options.orientation} onChange={(e) => setOptions({ ...options, orientation: e.target.value as PdfOptions['orientation'] })}>
            <option value="portrait">{t('pdf.portrait')}</option>
            <option value="landscape">{t('pdf.landscape')}</option>
          </select>
        </label>
      </div>
    </Modal>
  );
}
