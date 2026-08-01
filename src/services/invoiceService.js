import { getInvoice, getInvoiceWithFallback } from '@/services/db';
import { prepareInvoiceForRender } from '@/services/templateService';

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
 */

const LOG_TAG = '[INVOICE-SERVICE]';

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
      itemCount: invoice.items?.length
    });

    // Prepare for rendering if requested (used by Preview, PDF, etc.)
    if (prepareForRender) {
      const prepared = prepareInvoiceForRender(invoice);
      console.log(`${LOG_TAG}[LOAD] Invoice prepared for render`, {
        trace,
        invoiceNumber: prepared.invoiceNumber,
        preparedTotal: prepared.total,
        itemCount: prepared.items?.length
      });
      return prepared;
    }

    return invoice;
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

  // Check for corrupted prices
  const corruptedItems = invoice.items.filter(item => {
    // Price should never be 0 unless explicitly set by user
    if (item.price === 0 && item.productId) {
      console.error(`${LOG_TAG}[VALIDATION] Product-linked item has price 0`, {
        invoiceNumber: invoice.invoiceNumber,
        itemId: item.id,
        productId: item.productId,
        itemName: item.name
      });
      return true;
    }
    
    // Check for negative values
    if (item.price < 0 || item.quantity < 0) {
      console.error(`${LOG_TAG}[VALIDATION] Negative values found`, {
        invoiceNumber: invoice.invoiceNumber,
        itemId: item.id,
        price: item.price,
        quantity: item.quantity
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

  // Check totals consistency
  if (invoice.total === 0 && invoice.items.length > 0) {
    const hasValidItems = invoice.items.some(item => item.price > 0 && item.quantity > 0);
    if (hasValidItems) {
      console.error(`${LOG_TAG}[VALIDATION] Total is 0 but valid items exist`, {
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        itemCount: invoice.items.length,
        items: invoice.items.map(i => ({ name: i.name, price: i.price, quantity: i.quantity }))
      });
      return { valid: false, reason: 'Total is 0 but valid items exist' };
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