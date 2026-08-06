import { formatCurrency, formatDate, getEffectiveStatus } from '@/types/invoice';

/**
 * Shared data extraction for all invoice templates.
 *
 * SKU design:
 *   item.sku  — dedicated SKU field, populated when a product-picker item is added.
 *               Never derived from item.id or description.
 *   item.description — free-form user text, rendered below the item name.
 *
 * Use `d.itemSku(item)` in templates to get the SKU string ('' if none).
 */
export function useInvoiceData(invoice) {
  if (!invoice) return null;

  return {
    companyName: invoice.companyName || 'Your Company',
    companyEmail: invoice.companyEmail || '',
    companyPhone: invoice.companyPhone || '',
    companyAddress: invoice.companyAddress || '',
    companyLogo: invoice.companyLogo || null,
    companyGst: invoice.companyGst || '',
    clientName: invoice.clientName || '',
    clientEmail: invoice.clientEmail || '',
    clientGst: invoice.clientGst || '',
    billingAddress: invoice.billingAddress || '',
    invoiceNumber: invoice.invoiceNumber || '',
    issueDate: formatDate(invoice.issueDate),
    dueDate: formatDate(invoice.dueDate),
    status: getEffectiveStatus(invoice),
    currency: invoice.currency || '₹',
    items: invoice.items || [],
    subTotal: formatCurrency(invoice.subTotal, invoice.currency),
    taxAmount: formatCurrency(invoice.taxAmount, invoice.currency),
    discountAmount: formatCurrency(invoice.discountAmount, invoice.currency),
    shippingCharges: parseFloat(invoice.shippingCharges || 0),
    total: formatCurrency(invoice.total, invoice.currency),
    taxRate: invoice.taxRate || 0,
    discountRate: invoice.discountRate || 0,
    notes: invoice.notes || '',
    terms: invoice.terms || '',
    hasDiscount: invoice.discountAmount > 0,
    hasTax: invoice.taxAmount > 0,
    hasShipping: parseFloat(invoice.shippingCharges || 0) > 0,
    hasNotes: !!(invoice.notes || invoice.terms),
    // Returns the clean SKU string for a line item.
    // Reads from item.sku (the canonical field).  Falls back to parsing a
    // legacy "SKU: PRD-XXXXXX" description written by an older version of the
    // editor, so existing invoices keep displaying their SKU correctly.
    itemSku: (item) => {
      if (item.sku && String(item.sku).trim()) return String(item.sku).trim();
      // Legacy fallback: description was "SKU: PRD-000001"
      if (item.description) {
        const m = String(item.description).match(/^SKU:\s*(.+)$/i);
        if (m) return m[1].trim();
      }
      return '';
    },
    // Returns item.description, stripping the legacy "SKU: ..." prefix so it
    // is never shown twice in templates that also call itemSku().
    itemDescription: (item) => {
      if (!item.description) return '';
      if (/^SKU:\s*.+$/i.test(String(item.description))) return '';
      return String(item.description);
    },
    itemAmount: (item) => {
      // CRITICAL FIX: Only default to 0 if price is actually null/undefined
      const price = (item.price === null || item.price === undefined) ? 0 : parseFloat(item.price);
      const quantity = parseInt(item.quantity || 0, 10);
      const amt = price * quantity;
      return formatCurrency(amt, invoice.currency);
    },
    itemPrice: (item) => {
      // CRITICAL FIX: Only default to 0 if price is actually null/undefined
      const price = (item.price === null || item.price === undefined) ? 0 : parseFloat(item.price);
      return `${invoice.currency}${price.toFixed(2)}`;
    },
  };
}
