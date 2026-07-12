import {
  reduceProductStock,
  restoreProductStock,
  setProductStock,
  createInventoryRecord,
  getProduct,
} from '@/services/db';
import { INVENTORY_ACTIONS } from '@/types/inventory';
import { INVOICE_STATUS } from '@/types/invoice';

/**
 * Extract stock-relevant items from an invoice (product-linked only).
 */
function getStockItems(invoice) {
  if (!invoice?.items) return [];
  return invoice.items.filter(
    (item) => item.productId && parseInt(item.quantity, 10) > 0,
  );
}

/**
 * Aggregate items by productId to avoid duplicate operations.
 */
function aggregateByProduct(items) {
  const map = new Map();
  for (const item of items) {
    const qty = parseInt(item.quantity, 10) || 0;
    if (!item.productId || qty <= 0) continue;
    map.set(item.productId, (map.get(item.productId) || 0) + qty);
  }
  return map;
}

/**
 * Log an inventory movement to the audit trail.
 */
async function logMovement({
  productId,
  productName,
  sku,
  previousStock,
  quantityChanged,
  newStock,
  action,
  reference,
}) {
  return createInventoryRecord({
    productId,
    productName: productName || '',
    sku: sku || '',
    previousStock,
    quantityChanged,
    newStock,
    action,
    reference: reference || '',
  });
}

/**
 * Deduct stock for invoice line items (Sale action).
 */
export async function deductStockForInvoice(invoice, reference) {
  const ref = reference || invoice.invoiceNumber || 'Invoice';
  const aggregated = aggregateByProduct(getStockItems(invoice));
  const results = [];

  for (const [productId, quantity] of aggregated) {
    const result = await reduceProductStock(productId, quantity);
    if (result) {
      await logMovement({
        productId,
        productName: result.name,
        sku: result.sku,
        previousStock: result.previousStock,
        quantityChanged: result.quantityChanged,
        newStock: result.currentStock,
        action: INVENTORY_ACTIONS.SALE,
        reference: ref,
      });
      results.push(result);
    }
  }

  return results;
}

/**
 * Restore stock for invoice line items (Restored action).
 */
export async function restoreStockForInvoice(invoice, reference) {
  const ref = reference || invoice.invoiceNumber || 'Invoice';
  const aggregated = aggregateByProduct(getStockItems(invoice));
  const results = [];

  for (const [productId, quantity] of aggregated) {
    const result = await restoreProductStock(productId, quantity);
    if (result) {
      await logMovement({
        productId,
        productName: result.name,
        sku: result.sku,
        previousStock: result.previousStock,
        quantityChanged: result.quantityChanged,
        newStock: result.currentStock,
        action: INVENTORY_ACTIONS.RESTORED,
        reference: ref,
      });
      results.push(result);
    }
  }

  return results;
}

/**
 * Check if invoice status means stock has been deducted.
 */
export function isStockDeductedStatus(status) {
  return status === INVOICE_STATUS.PAID;
}

/**
 * Compare invoice items for stock-relevant changes.
 */
export function invoiceItemsChanged(oldInvoice, newInvoice) {
  const oldAgg = aggregateByProduct(getStockItems(oldInvoice));
  const newAgg = aggregateByProduct(getStockItems(newInvoice));

  if (oldAgg.size !== newAgg.size) return true;

  for (const [productId, qty] of oldAgg) {
    if (newAgg.get(productId) !== qty) return true;
  }

  return false;
}

/**
 * Handle invoice save/update with proper stock transitions.
 *
 * Rules:
 * - Only 'paid' status deducts stock
 * - Leaving 'paid' restores stock
 * - Editing a paid invoice: restore old items, deduct new items (if still paid)
 */
export async function handleInvoiceStockUpdate(oldInvoice, newInvoice) {
  const wasPaid = oldInvoice ? isStockDeductedStatus(oldInvoice.status) : false;
  const willBePaid = isStockDeductedStatus(newInvoice.status);
  const reference = newInvoice.invoiceNumber || oldInvoice?.invoiceNumber || 'Invoice';

  if (wasPaid && willBePaid) {
    if (invoiceItemsChanged(oldInvoice, newInvoice)) {
      await restoreStockForInvoice(oldInvoice, reference);
      await deductStockForInvoice(newInvoice, reference);
    }
    return;
  }

  if (wasPaid && !willBePaid) {
    await restoreStockForInvoice(oldInvoice, reference);
    return;
  }

  if (!wasPaid && willBePaid) {
    await deductStockForInvoice(newInvoice, reference);
  }
}

/**
 * Handle invoice deletion stock restoration.
 * Only paid invoices had stock deducted.
 */
export async function handleInvoiceDelete(invoice) {
  if (!invoice) return;
  if (isStockDeductedStatus(invoice.status)) {
    await restoreStockForInvoice(invoice, invoice.invoiceNumber);
  }
}

/**
 * Log manual stock adjustment when product stock is changed directly.
 */
export async function logManualStockUpdate(productId, previousStock, newStock, reference = 'Manual Update') {
  const product = await getProduct(productId);
  if (!product) return;

  const quantityChanged = newStock - previousStock;
  if (quantityChanged === 0) return;

  await logMovement({
    productId,
    productName: product.name,
    sku: product.sku,
    previousStock,
    quantityChanged,
    newStock,
    action: INVENTORY_ACTIONS.STOCK_UPDATED,
    reference,
  });
}

/**
 * Log product creation with initial stock.
 */
export async function logProductCreated(product, reference = 'Product Creation') {
  if (!product || !product.id) return;

  const stock = product.currentStock || 0;
  if (stock <= 0) {
    await logMovement({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      previousStock: 0,
      quantityChanged: 0,
      newStock: 0,
      action: INVENTORY_ACTIONS.PRODUCT_CREATED,
      reference,
    });
    return;
  }

  await logMovement({
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    previousStock: 0,
    quantityChanged: stock,
    newStock: stock,
    action: INVENTORY_ACTIONS.PRODUCT_CREATED,
    reference,
  });
}

/**
 * Log product deletion (records final stock state).
 */
export async function logProductDeleted(product, reference = 'Product Deletion') {
  if (!product) return;

  await logMovement({
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    previousStock: product.currentStock || 0,
    quantityChanged: -(product.currentStock || 0),
    newStock: 0,
    action: INVENTORY_ACTIONS.PRODUCT_DELETED,
    reference,
  });
}

/**
 * Log manual adjustment (generic).
 */
export async function logManualAdjustment(productId, previousStock, quantityChanged, newStock, reference = 'Manual Adjustment') {
  const product = await getProduct(productId);
  if (!product) return;

  await logMovement({
    productId,
    productName: product.name,
    sku: product.sku,
    previousStock,
    quantityChanged,
    newStock,
    action: INVENTORY_ACTIONS.MANUAL_ADJUSTMENT,
    reference,
  });
}

export { setProductStock };
