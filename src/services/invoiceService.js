import { getInvoice, getInvoiceWithFallback, normalizeId } from '@/services/db';
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
 *
 * Sync-race resilience (TASK 1):
 *   If initial lookup misses (because background INCR-PULL has not yet written
 *   the document into IndexedDB), wait for the next `data-refreshed` event OR
 *   a 400 ms timeout (whichever comes first), then perform exactly ONE final
 *   lookup.  Never create infinite loops; never poll.
 *
 * Promise deduplication:
 *   Concurrent loads for the same normalized id share the same pending promise,
 *   avoiding duplicate IndexedDB scans + duplicate retry waits.
 */

const LOG_TAG = '[INVOICE-SERVICE]';
const INVOICE_LOAD_LOG = '[INVOICE-LOAD]';

// ── Deduplication: in-flight promises keyed by `String(normalizeId(id))` ──
const _pendingLoads = new Map();

// ── Retry schedule for sync-race recovery ────────────────────────────────
// Each entry is the maximum ms to wait for `data-refreshed` before that
// attempt's own timeout fires.  If `data-refreshed` arrives earlier, the
// attempt proceeds immediately — so on a fast connection the total wait is
// much shorter than the sum of these values.
//
// Attempt 0 — immediate (no wait, handled in STEP 1)
// Attempt 1 — wait up to 500 ms  (or until data-refreshed)
// Attempt 2 — wait up to 1 000 ms
// Attempt 3 — wait up to 2 000 ms
// Attempt 4 — wait up to 4 000 ms  ← max total ~7.5 s
const SYNC_WAIT_SCHEDULE_MS = [500, 1_000, 2_000, 4_000];

// Wait for `data-refreshed` event OR `timeoutMs`, whichever comes first.
// Never rejects.  Resolves with 'data-refreshed' or 'timeout'.
function _waitForDataRefreshedOrTimeout(timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutHandle = null;

    const finish = (reason) => {
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      try { window.removeEventListener('data-refreshed', onEvent); } catch { void 0; }
      resolve(reason);
    };

    const onEvent = () => finish('data-refreshed');

    try {
      window.addEventListener('data-refreshed', onEvent, { once: true, passive: true });
    } catch {
      // No window (SSR/test): fall straight through to timeout
    }

    timeoutHandle = setTimeout(() => finish('timeout'), timeoutMs);
  });
}

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
 * Internal load implementation WITHOUT dedup.
 * Contains the sync-race resilience logic: initial lookup → wait for data-refreshed
 * OR timeout → ONE final retry lookup.
 */
async function _loadInvoiceImpl(id, opts) {
  const {
    trace = 'unknown',
    prepareForRender = true,
    retries = 3,
  } = opts;

  const rawIdStr = String(id);

  console.log(`${LOG_TAG}[LOAD] Starting invoice load`, {
    trace,
    rawId: rawIdStr,
    idType: typeof id,
    prepareForRender,
  });

  // ── Post-processing: repair totals + optional prepareForRender ──────────
  const finalize = (invoice) => {
    if (!invoice) return null;

    console.log(`${LOG_TAG}[LOAD] Invoice loaded successfully`, {
      trace,
      invoiceNumber: invoice.invoiceNumber,
      invoiceId: invoice.id,
      total: invoice.total,
      status: invoice.status,
      itemCount: invoice.items?.length,
    });

    const repairedInvoice = repairInvoiceTotals(invoice);
    if (repairedInvoice !== invoice) {
      console.log(`${LOG_TAG}[LOAD] Invoice totals repaired`, {
        trace,
        invoiceNumber: repairedInvoice.invoiceNumber,
        oldSubTotal: invoice.subTotal,
        newSubTotal: repairedInvoice.subTotal,
        oldTotal: invoice.total,
        newTotal: repairedInvoice.total,
      });
    }

    if (prepareForRender) {
      const prepared = prepareInvoiceForRender(repairedInvoice);
      console.log(`${LOG_TAG}[LOAD] Invoice prepared for render`, {
        trace,
        invoiceNumber: prepared.invoiceNumber,
        preparedTotal: prepared.total,
        status: prepared.status,
        itemCount: prepared.items?.length,
      });
      return prepared;
    }

    return repairedInvoice;
  };

  try {
    // ── STEP 1: Initial lookup chain ──────────────────────────────────────
    // getInvoice already has its own internal retry + fallback scan, so a
    // single call here is sufficient as the "immediate" attempt.
    let invoice = await getInvoice(id, { trace, retries });
    if (invoice) {
      console.log(`${INVOICE_LOAD_LOG} Initial lookup hit`, { trace, rawId: rawIdStr });
      return finalize(invoice);
    }
    console.log(`${INVOICE_LOAD_LOG} Initial lookup missed`, { trace, rawId: rawIdStr });

    // ── STEPS 2-N: Sync-race recovery loop ───────────────────────────────
    // The invoice may not be in IndexedDB yet because incrementalPullFromCloud
    // is still writing.  We listen for the `data-refreshed` event that sync
    // fires when it finishes, then retry.  Each iteration has its own timeout
    // so we never wait longer than the total schedule allows (~7.5 s).
    //
    // Rules:
    //   • Maximum SYNC_WAIT_SCHEDULE_MS.length attempts (currently 4)
    //   • One `data-refreshed` listener active at a time — no polling
    //   • If the invoice is found at any point, return immediately
    //   • If all attempts exhaust, fall through to the last-ditch scan

    for (let attempt = 0; attempt < SYNC_WAIT_SCHEDULE_MS.length; attempt++) {
      const waitMs = SYNC_WAIT_SCHEDULE_MS[attempt];
      console.log(`${INVOICE_LOAD_LOG} Waiting for data refresh (attempt ${attempt + 1}/${SYNC_WAIT_SCHEDULE_MS.length}, timeout ${waitMs}ms)...`, { trace, rawId: rawIdStr });

      const waitedFor = await _waitForDataRefreshedOrTimeout(waitMs);

      console.log(`${INVOICE_LOAD_LOG} ${waitedFor === 'data-refreshed' ? 'Data refresh received' : 'Wait timeout reached'} — retrying lookup (attempt ${attempt + 1})`, { trace, rawId: rawIdStr, waitedFor });

      invoice = await getInvoice(id, { trace, retries: 2, bustCache: true });
      if (invoice) {
        console.log(`${INVOICE_LOAD_LOG} Retry successful (attempt ${attempt + 1})`, { trace, rawId: rawIdStr });
        return finalize(invoice);
      }

      // If we got `data-refreshed` and still missed, the invoice is not in
      // this sync batch.  Fall through to the next attempt or give up.
      if (waitedFor === 'data-refreshed') {
        // No point waiting for another data-refreshed that may never come;
        // do one last-ditch scan right now before moving to the next slot.
        const quick = await getInvoiceWithFallback(id, { trace });
        if (quick) {
          console.log(`${INVOICE_LOAD_LOG} Retry successful via fallback scan (attempt ${attempt + 1})`, { trace, rawId: rawIdStr });
          return finalize(quick);
        }
      }
    }

    // ── FINAL: Last-ditch full fallback scan ──────────────────────────────
    console.log(`${INVOICE_LOAD_LOG} All sync-wait attempts exhausted — running final fallback scan`, { trace, rawId: rawIdStr });
    const lastDitch = await getInvoiceWithFallback(id, { trace });
    if (lastDitch) {
      console.log(`${INVOICE_LOAD_LOG} Invoice found via final fallback scan`, { trace, rawId: rawIdStr });
      return finalize(lastDitch);
    }

    console.log(`${INVOICE_LOAD_LOG} Final not found after sync timeout`, { trace, rawId: rawIdStr });
    console.warn(`${LOG_TAG}[LOAD] Invoice not found after exhausting all sync-wait attempts`, { trace, rawId: rawIdStr });
    return null;
  } catch (error) {
    console.error(`${LOG_TAG}[LOAD] Error loading invoice`, {
      trace,
      rawId: rawIdStr,
      error: error?.message ?? String(error),
      stack: error?.stack,
    });
    return null;
  }
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
  // Dedup key: same normalized id → same promise → exactly one IndexedDB scan + retry.
  const nid = normalizeId(id);
  const cacheKey = `${String(nid)}::${opts.prepareForRender === false ? 'raw' : 'rendered'}`;

  const existing = _pendingLoads.get(cacheKey);
  if (existing) {
    const trace = opts?.trace ?? 'unknown';
    console.log(`${INVOICE_LOAD_LOG} Reusing pending promise`, { trace, cacheKey });
    return existing;
  }

  const promise = _loadInvoiceImpl(id, opts).finally(() => {
    _pendingLoads.delete(cacheKey);
  });
  _pendingLoads.set(cacheKey, promise);
  return promise;
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
 *
 * Return shape:
 *   { success: true,  found: true,  invoice, validation }
 *   { success: false, found: true,  invoice, reason, validation }  ← loaded but corrupt
 *   { success: false, found: false, invoice: null, reason }        ← genuinely missing
 *
 * Callers MUST use `found` to decide whether to navigate away.
 * A validation failure on a found invoice should open the editor with a
 * warning, not redirect — the totals repair pass inside _loadInvoiceImpl
 * already fixes most structural issues before we even get here.
 */
export async function loadInvoiceWithValidation(id, opts = {}) {
  const invoice = await loadInvoice(id, opts);
  
  if (!invoice) {
    return { success: false, found: false, invoice: null, reason: 'Invoice not found' };
  }

  const validation = validateInvoiceIntegrity(invoice);
  
  if (!validation.valid) {
    console.warn(`${LOG_TAG}[LOAD-WITH-VALIDATION] Validation warning (invoice found but has integrity issue)`, {
      invoiceNumber: invoice.invoiceNumber,
      reason: validation.reason
    });
    // found=true: the invoice exists in IndexedDB — do NOT navigate away.
    // The editor will open and the user can inspect / correct the data.
    return { 
      success: false,
      found: true,
      invoice, 
      reason: validation.reason,
      validation 
    };
  }

  return { success: true, found: true, invoice, validation };
}

export default {
  loadInvoice,
  loadInvoiceWithValidation,
  validateInvoiceIntegrity
};