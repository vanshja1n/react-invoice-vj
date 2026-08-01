import { getInvoice, getInvoiceWithFallback } from '@/services/db';
import { prepareInvoiceForRender } from '@/services/templateService';
import { calculateInvoiceTotals, filterValidItems } from '@/types/invoice';

/**
 * CENTRALIZED INVOICE LOADING SERVICE
 * 
 * This is the single source of truth for loading invoices across the application.
 * All pages (Preview, Edit, History, PDF, Dashboard) must use this function.
 * 
 * Benefits:
 * - Consistent ID handling across all routes
 * - Consistent data preparation
 * - Centralized error handling
 * - Comprehensive logging
 * - Automatic repair of missing totals for backward compatibility
 */

const LOG_TAG = '[INVOICE-SERVICE]';

/**
 * Repair missing totals in an invoice
 * This ensures backward compatibility with older invoices that might be missing
 * subtotal, total, taxAmount, discountAmount, etc.
 */
function repairInvoiceTotals(invoice) {
  if (!invoice) return invoice;
  
  const validItems = filterValidItems(invoice.items || []);
  
  // If totals are missing or invalid, recalculate from line items
  const needsRepair = (
    invoice.subTotal === null || 
    invoice.subTotal === undefined ||
    invoice.total === null ||
    invoice.total === undefined ||
    isNaN(invoice.subTotal) ||
    isNaN(invoice.total)
  );
  
  if (needsRepair && validItems.length > 0) {
    console.log(`${LOG_TAG}[REPAIR] Recalculating missing totals`, {
      invoiceNumber: invoice.invoiceNumber,
      currentSubTotal: invoice.subTotal,
      currentTotal: invoice.total,
      itemCount: validItems.length
    });
    
    const recalculated = calculateInvoiceTotals(
      validItems,
      invoice.taxRate,
      invoice.discountRate,
      invoice.shippingCharges
    );
    
    return {
      ...invoice,
      subTotal: recalculated.subTotal,
      taxAmount: recalculated.taxAmount,
      discountAmount: recalculated.discountAmount,
      total: recalculated.total,
      // Aliases for backward compatibility
      subtotal: recalculated.subTotal,
      amount: recalculated.total,
      grandTotal: recalculated.total,
    };
  }
  
  return invoice;
}

/**
 * Load invoice by ID with comprehensive fallback strategies
 * Used by: Preview, Edit, History, PDF generation, Dashboard
 * 
 * @param {string|number} id - Invoice ID (can be local ID, MongoDB ObjectId, or invoice number)
 * @param {Object} opts - Options
 * @param {string} opts.trace - Trace identifier for logging
 * @param {boolean} opts.prepareForRender - Whether to prepare for rendering (default: true)
 * @param {number} opts.retries - Number of retry attempts (default: 3)
 * @returns {Promise<Object|null>} Invoice object or null if not found
 */
export async function loadInvoice(id, opts = {}) {
  const {
    trace = 'unknown',
    prepareForRender = true,
    retries = 3
  } = opts;

  console.log(`${LOG_TAG}[LOAD] Starting invoice load`, {
    trace,
    rawId: String(id),
    idType: typeof id,
    prepareForRender
  });

  try {
    // Use the enhanced getInvoice function with fallback strategies
    const invoice = await getInvoice(id, { trace, retries });
    
    if (!invoice) {
      console.warn(`${LOG_TAG}[LOAD] Invoice not found`, { trace, rawId: String(id) });
      return null;
    }

    console.log(`${LOG_TAG}[LOAD] Invoice loaded successfully`, {
      trace,
      invoiceNumber: invoice.invoiceNumber,
      invoiceId: invoice.id,
      total: invoice.total,
      status: invoice.status,
      itemCount: invoice.items?.length
    });

    // CRITICAL: Repair missing totals for backward compatibility
    const repairedInvoice = repairInvoiceTotals(invoice);
    
    if (repairedInvoice !== invoice) {
      console.log(`${LOG_TAG}[LOAD] Invoice totals repaired`, {
        trace,
        invoiceNumber: repairedInvoice.invoiceNumber,
        oldSubTotal: invoice.subTotal,
        newSubTotal: repairedInvoice.subTotal,
        oldTotal: invoice.total,
        newTotal: repairedInvoice.total
      });
    }

    // Prepare for rendering if requested (used by Preview, PDF, etc.)
    if (prepareForRender) {
      const prepared = prepareInvoiceForRender(repairedInvoice);
      console.log(`${LOG_TAG}[LOAD] Invoice prepared for render`, {
        trace,
        invoiceNumber: prepared.invoiceNumber,
        preparedTotal: prepared.total,
        status: prepared.status,
        itemCount: prepared.items?.length
      });
      return prepared;
    }

    return repairedInvoice;
  } catch (error) {
    console.error(`${LOG_TAG}[LOAD] Error loading invoice`, {
      trace,
      rawId: String(id),
      error: error.message,
      stack: error.stack
    });
    return null;
  }
}

/**
 * Validate invoice data integrity
 * Checks for corrupted prices, quantities, and totals
 */
export function validateInvoiceIntegrity(invoice) {
  if (!invoice) {
    return { valid: false, reason: 'Invoice is null or undefined' };
  }

  if (!invoice.items || !Array.isArray(invoice.items)) {
    return { valid: false, reason: 'Invoice items are missing or invalid' };
  }

  // Check for structurally impossible data only.
  // price=0 is valid (free / promotional items — user set it intentionally).
  // Only flag negative prices or negative quantities which can never be correct.
  const corruptedItems = invoice.items.filter(item => {
    if (item.price < 0) {
      console.error(`${LOG_TAG}[VALIDATION] Negative price found`, {
        invoiceNumber: invoice.invoiceNumber,
        itemId: item.id,
        price: item.price,
      });
      return true;
    }
    if (item.quantity < 0) {
      console.error(`${LOG_TAG}[VALIDATION] Negative quantity found`, {
        invoiceNumber: invoice.invoiceNumber,
        itemId: item.id,
        quantity: item.quantity,
      });
      return true;
    }
    return false;
  });

  if (corruptedItems.length > 0) {
    return { 
      valid: false, 
      reason: `Found ${corruptedItems.length} corrupted line items`,
      corruptedItems 
    };
  }

  // total===0 is only corrupt when the invoice has items that should produce
  // a non-zero total (qty > 0 AND price > 0).  An all-free invoice (all
  // prices = 0) legitimately has total = 0.
  if (invoice.total === 0 && invoice.items.length > 0) {
    const hasChargeable = invoice.items.some(item => {
      const qty = typeof item.quantity === 'string' ? parseInt(item.quantity, 10) : (item.quantity || 0);
      const price = typeof item.price === 'string' ? parseFloat(item.price) : (item.price || 0);
      return qty > 0 && price > 0;
    });
    if (hasChargeable) {
      console.error(`${LOG_TAG}[VALIDATION] Total is 0 but chargeable items exist`, {
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        itemCount: invoice.items.length,
        items: invoice.items.map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
      });
      return { valid: false, reason: 'Total is 0 but chargeable items exist' };
    }
  }

  return { valid: true };
}

/**
 * Load invoice with integrity validation
 * Combines loading and validation for safety-critical operations
 */
export async function loadInvoiceWithValidation(id, opts = {}) {
  const invoice = await loadInvoice(id, opts);
  
  if (!invoice) {
    return { success: false, invoice: null, reason: 'Invoice not found' };
  }

  const validation = validateInvoiceIntegrity(invoice);
  
  if (!validation.valid) {
    console.error(`${LOG_TAG}[LOAD-WITH-VALIDATION] Validation failed`, {
      invoiceNumber: invoice.invoiceNumber,
      reason: validation.reason
    });
    return { 
      success: false, 
      invoice, 
      reason: validation.reason,
      validation 
    };
  }

  return { success: true, invoice, validation };
}

export default {
  loadInvoice,
  loadInvoiceWithValidation,
  validateInvoiceIntegrity
};