import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { InvoicePDF, INVOICE_PDF_CAPTURE_ID } from '@/components/pdf/InvoicePDF';

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const PDF_MARGIN_PT = 36;

let pdfMountContainer = null;
let pdfMountRoot = null;

async function mountInvoiceForPdf(invoice) {
  if (!pdfMountContainer) {
    pdfMountContainer = document.createElement('div');
    pdfMountContainer.className = 'invoice-pdf-container';
    pdfMountContainer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(pdfMountContainer);
    pdfMountRoot = createRoot(pdfMountContainer);
  }

  await new Promise((resolve) => {
    pdfMountRoot.render(createElement(InvoicePDF, { invoice }));
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function unmountInvoiceForPdf() {
  if (pdfMountRoot) {
    pdfMountRoot.render(null);
  }
}

async function waitForInvoiceRender(elementId = INVOICE_PDF_CAPTURE_ID) {
  const element = document.getElementById(elementId);
  if (!element) {
    await new Promise((r) => setTimeout(r, 150));
    return;
  }

  const images = element.querySelectorAll('img');
  await Promise.all(
    Array.from(images).map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = resolve;
          img.onerror = resolve;
        }),
    ),
  );

  await new Promise((r) => setTimeout(r, 50));
}

async function capturePdfFromElement(elementId = INVOICE_PDF_CAPTURE_ID) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} not found`);
  }

  const originalScrollTop = window.scrollY;
  window.scrollTo(0, 0);

  const width = element.offsetWidth;
  const height = element.scrollHeight;

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
    });

    const imgData = canvas.toDataURL('image/png', 1.0);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
    });

    const pageWidth = A4_WIDTH_PT;
    const pageHeight = A4_HEIGHT_PT;
    const contentWidth = pageWidth - PDF_MARGIN_PT * 2;
    const printableHeight = pageHeight - PDF_MARGIN_PT * 2;

    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = PDF_MARGIN_PT;

    pdf.addImage(imgData, 'PNG', PDF_MARGIN_PT, position, imgWidth, imgHeight);
    heightLeft -= printableHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + PDF_MARGIN_PT;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', PDF_MARGIN_PT, position, imgWidth, imgHeight);
      heightLeft -= printableHeight;
    }

    return { pdf };
  } finally {
    window.scrollTo(0, originalScrollTop);
  }
}

/**
 * Single PDF generation entry point for the entire app.
 * Renders the invoice off-screen, captures it, and returns the PDF artifacts.
 */
export async function generateInvoicePDF(invoice) {
  if (!invoice) {
    throw new Error('Invoice data is required');
  }

  await mountInvoiceForPdf(invoice);

  try {
    await waitForInvoiceRender();
    const filename = getInvoiceFilename(invoice);
    const { pdf } = await capturePdfFromElement();
    const blob = pdf.output('blob');

    return { pdf, blob, filename };
  } finally {
    unmountInvoiceForPdf();
  }
}

/**
 * Download the generated invoice PDF.
 */
export async function downloadInvoicePdf(invoice) {
  const { pdf, filename } = await generateInvoicePDF(invoice);
  pdf.save(filename);
}

/**
 * Open the generated PDF in a new tab and trigger the browser print dialog.
 */
export async function printInvoicePdf(invoice) {
  const { blob } = await generateInvoicePDF(invoice);
  const url = URL.createObjectURL(blob);

  const printWindow = window.open(url, '_blank');
  if (!printWindow) {
    URL.revokeObjectURL(url);
    throw new Error('Popup blocked. Please allow popups to print.');
  }

  let printTriggered = false;
  const triggerPrint = () => {
    if (printTriggered) return;
    printTriggered = true;
    printWindow.focus();
    printWindow.print();
  };

  printWindow.addEventListener('load', triggerPrint);
  setTimeout(triggerPrint, 1500);

  const cleanup = setInterval(() => {
    if (printWindow.closed) {
      URL.revokeObjectURL(url);
      clearInterval(cleanup);
    }
  }, 1000);
}

/**
 * Open the generated PDF in a new browser tab for preview.
 */
export async function previewInvoicePdf(invoice) {
  const { blob } = await generateInvoicePDF(invoice);
  const url = URL.createObjectURL(blob);
  const previewWindow = window.open(url, '_blank');

  if (!previewWindow) {
    URL.revokeObjectURL(url);
    throw new Error('Popup blocked. Please allow popups to preview the PDF.');
  }

  const cleanup = setInterval(() => {
    if (previewWindow.closed) {
      URL.revokeObjectURL(url);
      clearInterval(cleanup);
    }
  }, 1000);
}

/**
 * Generate filename from invoice data
 */
export function getInvoiceFilename(invoice) {
  const num = invoice.invoiceNumber || 'draft';
  const client = (invoice.clientName || 'client').replace(/[^a-zA-Z0-9]/g, '_');
  return `${num}_${client}.pdf`;
}
