import { getSettings } from '@/services/settings';
import { TEMPLATE_IDS, TEMPLATE_CONFIG, DEFAULT_TEMPLATE } from '@/types/template';
import { filterValidItems, calculateInvoiceTotals } from '@/types/invoice';

/**
 * Resolve which template to use for an invoice.
 * Invoice-level override takes precedence over settings default.
 */
export function resolveTemplateId(invoice) {
  if (invoice?.template && TEMPLATE_CONFIG[invoice.template]) {
    return invoice.template;
  }
  const settings = getSettings();
  const defaultTemplate = settings.defaultInvoiceTemplate || DEFAULT_TEMPLATE;
  return TEMPLATE_CONFIG[defaultTemplate] ? defaultTemplate : DEFAULT_TEMPLATE;
}

/**
 * Get template metadata by ID.
 */
export function getTemplateConfig(templateId) {
  return TEMPLATE_CONFIG[templateId] || TEMPLATE_CONFIG[DEFAULT_TEMPLATE];
}

/**
 * Prepare invoice data for rendering (PDF, preview, print).
 * Strips empty line items and resolves totals with full backward compatibility:
 *  - Accepts both camelCase "subTotal" and lowercase "subtotal" from stored docs
 *  - Falls back to recalculating from line items when stored totals are absent
 *  - Always emits the full canonical set of financial fields
 */
export function prepareInvoiceForRender(invoice) {
  if (!invoice) return null;

  const validItems = filterValidItems(invoice.items || []);

  // Resolve subTotal from either casing — old docs may have only "subtotal"
  const resolvedSubTotal =
    typeof invoice.subTotal === 'number' && !isNaN(invoice.subTotal)
      ? invoice.subTotal
      : typeof invoice.subtotal === 'number' && !isNaN(invoice.subtotal)
        ? invoice.subtotal
        : null;

  const resolvedTotal =
    typeof invoice.total === 'number' && !isNaN(invoice.total)
      ? invoice.total
      : typeof invoice.amount === 'number' && !isNaN(invoice.amount)
        ? invoice.amount
        : null;

  const hasValidTotals = resolvedSubTotal !== null && resolvedTotal !== null;

  const totals = hasValidTotals
    ? {
        subTotal:       resolvedSubTotal,
        subtotal:       resolvedSubTotal,   // lowercase alias
        taxAmount:      typeof invoice.taxAmount === 'number' ? invoice.taxAmount : 0,
        discountAmount: typeof invoice.discountAmount === 'number' ? invoice.discountAmount : 0,
        shippingCharges: typeof invoice.shippingCharges === 'number' ? invoice.shippingCharges : 0,
        total:          resolvedTotal,
        amount:         resolvedTotal,
        grandTotal:     resolvedTotal,
      }
    : (() => {
        const calc = calculateInvoiceTotals(
          validItems,
          invoice.taxRate,
          invoice.discountRate,
          invoice.shippingCharges,
        );
        return {
          subTotal:       calc.subTotal,
          subtotal:       calc.subTotal,
          taxAmount:      calc.taxAmount,
          discountAmount: calc.discountAmount,
          shippingCharges: parseFloat(invoice.shippingCharges || 0),
          total:          calc.total,
          amount:         calc.total,
          grandTotal:     calc.total,
        };
      })();

  return {
    ...invoice,
    items: validItems,
    ...totals,
  };
}

/**
 * Get the default template ID from settings.
 */
export function getDefaultTemplateId() {
  const settings = getSettings();
  const id = settings.defaultInvoiceTemplate || DEFAULT_TEMPLATE;
  return TEMPLATE_CONFIG[id] ? id : DEFAULT_TEMPLATE;
}

export { TEMPLATE_IDS, TEMPLATE_CONFIG, TEMPLATE_LIST } from '@/types/template';
