import { InvoiceTemplate } from '@/components/pdf/InvoiceTemplate';

/** A4 width at 96 DPI (210 mm) */
export const INVOICE_PDF_WIDTH_PX = 794;

/** A4 height at 96 DPI (297 mm) */
export const INVOICE_PDF_HEIGHT_PX = 1123;

/** DOM id used by html2canvas for PDF capture */
export const INVOICE_PDF_CAPTURE_ID = 'invoicePdfCapture';

/**
 * Fixed A4 container for PDF generation (download, ZIP export).
 * Off-screen rendering only — no responsive or viewport-based sizing.
 */
export function InvoicePDF({ invoice }) {
  if (!invoice) return null;

  return (
    <div
      id={INVOICE_PDF_CAPTURE_ID}
      style={{
        width: `${INVOICE_PDF_WIDTH_PX}px`,
        minHeight: `${INVOICE_PDF_HEIGHT_PX}px`,
        backgroundColor: '#ffffff',
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <InvoiceTemplate invoice={invoice} />
    </div>
  );
}
