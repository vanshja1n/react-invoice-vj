import { formatCurrency, formatDate, getEffectiveStatus } from '@/types/invoice';

/**
 * Shared data extraction for all invoice templates.
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
