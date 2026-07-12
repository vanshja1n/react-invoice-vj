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
 * Strips empty line items and recalculates totals.
 */
export function prepareInvoiceForRender(invoice) {
  if (!invoice) return null;

  const validItems = filterValidItems(invoice.items || []);
  const totals = calculateInvoiceTotals(
    validItems,
    invoice.taxRate,
    invoice.discountRate,
    invoice.shippingCharges,
  );

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
