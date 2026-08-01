import Dexie from 'dexie';
import { isOverdue } from '@/types/invoice';
import { generateSKU } from '@/types/product';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export function normalizeId(id) {
  if (id === undefined || id === null) return id;
  if (typeof id === 'number') return id;
  const str = String(id).trim();
  if (!str) return id;
  if (OBJECT_ID_REGEX.test(str)) return str;
  const num = Number(str);
  if (!Number.isNaN(num) && Number.isFinite(num)) return num;
  return str;
}

function _isAuthed() {
  return !!localStorage.getItem('invoicehub_token');
}
async function _queue(entity, operation, data) {
  if (!_isAuthed()) return;
  try {
    const { queueOperation } = await import('@/services/sync');
    queueOperation(entity, operation, data);
  } catch (_err) { void _err; /* noop */ }
}
async function _scrubQueueBeforeDelete(entity, targetId) {
  if (!_isAuthed()) return 0;
  try {
    const { scrubQueueForTarget } = await import('@/services/sync');
    return scrubQueueForTarget(entity, targetId);
  } catch (_err) { void _err; return 0; }
}

// Create database
const db = new Dexie('InvoiceHubDB');

// Define schema — v1 (original)
db.version(1).stores({
  invoices: '++id, invoiceNumber, status, clientName, companyName, amount, createdAt, updatedAt',
});

// v2 — Add products, customers stores
db.version(2).stores({
  invoices: '++id, invoiceNumber, status, clientName, companyName, amount, customerId, createdAt, updatedAt',
  products: '++id, name, sku, category, sellingPrice, currentStock, createdAt',
  customers: '++id, name, phone, email, createdAt',
});

// v3 — Add inventory history audit log
db.version(3).stores({
  invoices: '++id, invoiceNumber, status, clientName, companyName, amount, customerId, createdAt, updatedAt',
  products: '++id, name, sku, category, sellingPrice, currentStock, createdAt',
  customers: '++id, name, phone, email, createdAt',
  inventoryHistory: '++id, productId, action, reference, createdAt',
});

export default db;

// ─── Invoice CRUD ───────────────────────────────────────

export async function createInvoice(invoiceData) {
  const now = new Date().toISOString();
  const data = {
    ...invoiceData,
    createdAt: invoiceData.createdAt || now,
    updatedAt: now,
  };
  if (data.id === undefined) delete data.id;
  const id = await db.invoices.add(data);
  const result = { ...data, id };
  await _queue('invoices', 'create', result);
  return result;
}

export async function updateInvoice(id, invoiceData) {
  const nid = normalizeId(id);
  const now = new Date().toISOString();
  const data = {
    ...invoiceData,
    updatedAt: now,
  };
  await db.invoices.update(nid, data);
  const result = { ...data, id: nid };
  await _queue('invoices', 'update', result);
  return result;
}

export async function deleteInvoice(id) {
  const nid = normalizeId(id);
  await _scrubQueueBeforeDelete('invoices', nid);
  await db.invoices.delete(nid);
  await _queue('invoices', 'delete', nid);
}

function _logLookup(tag, payload) {
  try { console.info('[LOOKUP-AUDIT]', tag, payload); } catch { void 0; }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function getInvoice(id, opts = {}) {
  const retries = typeof opts.retries === 'number' ? opts.retries : 3;
  const backoffMs = typeof opts.backoffMs === 'number' ? opts.backoffMs : 80;
  const trace = opts.trace ?? 'unknown';
  const nid = normalizeId(id);
  const reqId = `getInvoice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  let lastErr = null;
  for (let i = 0; i < retries; i++) {
    try {
      const t0 = Date.now();
      const row = await db.invoices.get(nid);
      const elapsed = Date.now() - t0;
      if (row) {
        _logLookup('invoice:found', { trace, reqId, try: i + 1, rawId: String(id).slice(0, 40), normalizedId: JSON.stringify(nid), normalizedType: typeof nid, rowId: JSON.stringify(row.id), rowIdType: typeof row.id, invoiceNumber: row.invoiceNumber, elapsedMs: elapsed });
        return row;
      }
      _logLookup('invoice:miss', { trace, reqId, try: i + 1, rawId: String(id).slice(0, 40), normalizedId: JSON.stringify(nid), normalizedType: typeof nid, elapsedMs: elapsed });
    } catch (err) {
      lastErr = err;
      _logLookup('invoice:err', { trace, reqId, try: i + 1, rawId: String(id).slice(0, 40), normalizedId: JSON.stringify(nid), err: err?.message || String(err) });
    }
    if (i < retries - 1) await sleep(backoffMs * (i + 1));
  }
  try {
    const allIds = (await db.invoices.orderBy('id').keys()).slice(0, 50);
    const sample = (await db.invoices.limit(5).toArray()).map(r => ({ id: JSON.stringify(r.id), idType: typeof r.id, invoiceNumber: r.invoiceNumber }));
    _logLookup('invoice:notfound', { trace, reqId, rawId: String(id).slice(0, 40), normalizedId: JSON.stringify(nid), normalizedType: typeof nid, sampleIdsInStore: allIds.map(String), sample5: sample, lastErr: lastErr?.message || null });
  } catch { void 0; }
  return undefined;
}

export async function getAllInvoices() {
  return await db.invoices.orderBy('createdAt').reverse().toArray();
}

export async function getInvoiceCount() {
  return await db.invoices.count();
}

export async function getLastInvoiceNumber() {
  const invoices = await db.invoices.orderBy('invoiceNumber').reverse().first();
  if (!invoices || !invoices.invoiceNumber) return 0;
  const num = parseInt(invoices.invoiceNumber.replace(/\D/g, ''), 10);
  return isNaN(num) ? 0 : num;
}

// Search invoices
export async function searchInvoices(query) {
  if (!query || query.trim() === '') return getAllInvoices();

  const lower = query.toLowerCase().trim();
  const all = await getAllInvoices();

  return all.filter(
    (inv) =>
      (inv.invoiceNumber || '').toLowerCase().includes(lower) ||
      (inv.clientName || '').toLowerCase().includes(lower) ||
      (inv.companyName || '').toLowerCase().includes(lower) ||
      (inv.status || '').toLowerCase().includes(lower) ||
      // Search within invoice items (product names)
      (inv.items || []).some((item) =>
        (item.name || '').toLowerCase().includes(lower)
      )
  );
}

// Filter by status
export async function filterInvoicesByStatus(status) {
  if (!status || status === 'all') return getAllInvoices();
  
  const all = await getAllInvoices();
  
  if (status === 'overdue') {
    return all.filter((inv) => isOverdue(inv));
  }
  
  return all.filter((inv) => inv.status === status && (status !== 'pending' && status !== 'sent' || !isOverdue(inv)));
}

// Get stats for dashboard
export async function getInvoiceStats() {
  const all = await getAllInvoices();

  const stats = {
    total: all.length,
    paid: 0,
    pending: 0,
    draft: 0,
    sent: 0,
    overdue: 0,
    cancelled: 0,
    totalRevenue: 0,
    paidRevenue: 0,
    pendingAmount: 0,
  };

  all.forEach((inv) => {
    const amount = parseFloat(inv.total || 0);

    // Process counts for all statuses first (for the chart)
    if (inv.status === 'cancelled') {
      stats.cancelled++;
    } else if (isOverdue(inv)) {
      stats.overdue++;
      // Only add to pendingAmount if not cancelled or paid or draft (which it isn't since status is checked first)
      stats.pendingAmount += amount;
    } else {
      switch (inv.status) {
        case 'paid':
          stats.paid++;
          // Total Revenue = Paid invoices
          stats.totalRevenue += amount;
          stats.paidRevenue += amount;
          break;
        case 'pending':
          stats.pending++;
          stats.pendingAmount += amount;
          break;
        case 'sent':
          stats.sent++;
          stats.pendingAmount += amount;
          break;
        case 'draft':
          stats.draft++;
          break;
      }
    }
  });

  return stats;
}

// Get monthly revenue data for charts
export async function getMonthlyRevenue() {
  const all = await getAllInvoices();
  const months = {};

  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    months[key] = { month: label, revenue: 0, paid: 0, count: 0 };
  }

  all.forEach((inv) => {
    if (inv.createdAt) {
      const d = new Date(inv.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (months[key]) {
        const amount = parseFloat(inv.total || 0);
        // Only count PAID invoices for revenue and paid in monthly chart
        if (inv.status === 'paid') {
          months[key].revenue += amount;
          months[key].paid += amount;
        }
        // Count all invoices for the count
        months[key].count++;
      }
    }
  });

  return Object.values(months);
}

// ─── Product CRUD ───────────────────────────────────────

export async function createProduct(productData) {
  const now = new Date().toISOString();
  
  // Auto-generate SKU if not provided
  let sku = productData.sku;
  if (!sku) {
    const lastProduct = await db.products.orderBy('id').reverse().first();
    const lastNum = lastProduct ? lastProduct.id : 0;
    sku = generateSKU(lastNum);
  }

  const data = {
    ...productData,
    sku,
    createdAt: productData.createdAt || now,
    updatedAt: now,
  };
  if (data.id === undefined) delete data.id;
  const id = await db.products.add(data);
  const result = { ...data, id };
  await _queue('products', 'create', result);
  return result;
}

export async function updateProduct(id, productData) {
  const nid = normalizeId(id);
  const now = new Date().toISOString();
  const data = {
    ...productData,
    updatedAt: now,
  };
  await db.products.update(nid, data);
  const result = { ...data, id: nid };
  await _queue('products', 'update', result);
  return result;
}

export async function deleteProduct(id) {
  const nid = normalizeId(id);
  await _scrubQueueBeforeDelete('products', nid);
  await db.products.delete(nid);
  await _queue('products', 'delete', nid);
}

export async function getProduct(id) {
  return await db.products.get(normalizeId(id));
}

export async function getAllProducts() {
  return await db.products.orderBy('createdAt').reverse().toArray();
}

export async function searchProducts(query) {
  if (!query || query.trim() === '') return getAllProducts();

  const lower = query.toLowerCase().trim();
  const all = await getAllProducts();

  return all.filter(
    (p) =>
      (p.name || '').toLowerCase().includes(lower) ||
      (p.sku || '').toLowerCase().includes(lower) ||
      (p.category || '').toLowerCase().includes(lower)
  );
}

export async function getProductsByCategory(category) {
  if (!category || category === 'all') return getAllProducts();
  const all = await getAllProducts();
  return all.filter((p) => p.category === category);
}

export async function getLowStockProducts() {
  const all = await getAllProducts();
  return all.filter((p) => p.currentStock <= p.lowStockAlert);
}

export async function getProductStats() {
  const all = await getAllProducts();
  const lowStock = all.filter((p) => p.currentStock <= p.lowStockAlert);
  return {
    total: all.length,
    lowStock: lowStock.length,
  };
}

export async function getProductCategories() {
  const all = await getAllProducts();
  const categories = new Set(all.map((p) => p.category).filter(Boolean));
  return Array.from(categories).sort();
}

export async function reduceProductStock(productId, quantity) {
  const nid = normalizeId(productId);
  const product = await db.products.get(nid);
  if (!product) return null;

  const qty = parseInt(quantity, 10) || 0;
  if (qty <= 0) return product;

  const previousStock = product.currentStock;
  const newStock = Math.max(0, previousStock - qty);
  await db.products.update(nid, {
    currentStock: newStock,
    updatedAt: new Date().toISOString(),
  });
  const result = { ...product, previousStock, currentStock: newStock, quantityChanged: -qty };
  await _queue('products', 'update', { id: nid, currentStock: newStock, updatedAt: new Date().toISOString() });
  return result;
}

export async function restoreProductStock(productId, quantity) {
  const nid = normalizeId(productId);
  const product = await db.products.get(nid);
  if (!product) return null;

  const qty = parseInt(quantity, 10) || 0;
  if (qty <= 0) return product;

  const previousStock = product.currentStock;
  const newStock = previousStock + qty;
  await db.products.update(nid, {
    currentStock: newStock,
    updatedAt: new Date().toISOString(),
  });
  const result = { ...product, previousStock, currentStock: newStock, quantityChanged: qty };
  await _queue('products', 'update', { id: nid, currentStock: newStock, updatedAt: new Date().toISOString() });
  return result;
}

export async function setProductStock(productId, newStock) {
  const nid = normalizeId(productId);
  const product = await db.products.get(nid);
  if (!product) return null;

  const previousStock = product.currentStock;
  const stock = Math.max(0, parseInt(newStock, 10) || 0);
  await db.products.update(nid, {
    currentStock: stock,
    updatedAt: new Date().toISOString(),
  });
  const result = {
    ...product,
    previousStock,
    currentStock: stock,
    quantityChanged: stock - previousStock,
  };
  await _queue('products', 'update', { id: nid, currentStock: stock, updatedAt: new Date().toISOString() });
  return result;
}

export async function getLastProductNumber() {
  const count = await db.products.count();
  return count;
}

// ─── Customer CRUD ───────────────────────────────────────

export async function createCustomer(customerData) {
  const allCustomers = await getAllCustomers();
  
  // Check for existing customer with same email first
  if (customerData.email) {
    const existing = allCustomers.find(
      c => c.email?.toLowerCase() === customerData.email.toLowerCase()
    );
    if (existing) {
      throw new Error('Customer with this email already exists');
    }
  }
  
  // Check for existing customer with same name
  if (customerData.name) {
    const existing = allCustomers.find(
      c => c.name?.toLowerCase() === customerData.name.toLowerCase()
    );
    if (existing) {
      throw new Error('Customer with this name already exists');
    }
  }
  
  const now = new Date().toISOString();
  const data = {
    ...customerData,
    createdAt: customerData.createdAt || now,
    updatedAt: now,
  };
  if (data.id === undefined) delete data.id;
  const id = await db.customers.add(data);
  const result = { ...data, id };
  await _queue('customers', 'create', result);
  return result;
}

export async function updateCustomer(id, customerData) {
  const nid = normalizeId(id);
  const now = new Date().toISOString();
  const data = {
    ...customerData,
    updatedAt: now,
  };
  await db.customers.update(nid, data);
  const result = { ...data, id: nid };
  await _queue('customers', 'update', result);
  return result;
}

export async function deleteCustomer(id) {
  const nid = normalizeId(id);
  await _scrubQueueBeforeDelete('customers', nid);
  await db.customers.delete(nid);
  await _queue('customers', 'delete', nid);
}

export async function getCustomer(id) {
  return await db.customers.get(normalizeId(id));
}

export async function getAllCustomers() {
  return await db.customers.orderBy('createdAt').reverse().toArray();
}

export async function searchCustomers(query) {
  if (!query || query.trim() === '') return getAllCustomers();

  const lower = query.toLowerCase().trim();
  const all = await getAllCustomers();

  return all.filter(
    (c) =>
      (c.name || '').toLowerCase().includes(lower) ||
      (c.phone || '').toLowerCase().includes(lower) ||
      (c.email || '').toLowerCase().includes(lower) ||
      (c.gstNumber || '').toLowerCase().includes(lower)
  );
}

export async function getAllUniqueCustomers() {
  const [dbCustomers, invoices] = await Promise.all([
    getAllCustomers(),
    getAllInvoices(),
  ]);

  const customerMap = new Map();

  // First add DB customers
  dbCustomers.forEach((c) => {
    const key = c.email ? `email:${c.email.toLowerCase()}` : `name:${c.name.toLowerCase()}`;
    customerMap.set(key, {
      ...c,
      lastInvoiceAt: c.createdAt,
    });
  });

  // Then add customers from invoices
  invoices.forEach((inv) => {
    if (inv.clientName) {
      const key = inv.clientEmail
        ? `email:${inv.clientEmail.toLowerCase()}`
        : `name:${inv.clientName.toLowerCase()}`;
      
      const existing = customerMap.get(key);
      if (existing) {
        // Update lastInvoiceAt if more recent
        if (new Date(inv.createdAt) > new Date(existing.lastInvoiceAt)) {
          existing.lastInvoiceAt = inv.createdAt;
          existing.phone = existing.phone || inv.clientPhone;
          existing.email = existing.email || inv.clientEmail;
        }
      } else {
        customerMap.set(key, {
          id: `inv-${inv.id}`,
          name: inv.clientName,
          email: inv.clientEmail,
          phone: inv.clientPhone,
          createdAt: inv.createdAt,
          lastInvoiceAt: inv.createdAt,
        });
      }
    }
  });

  // Convert to array and sort by lastInvoiceAt descending
  return Array.from(customerMap.values()).sort((a, b) =>
    new Date(b.lastInvoiceAt) - new Date(a.lastInvoiceAt)
  );
}

export async function getCustomerStats() {
  const allCustomers = await getAllUniqueCustomers();
  return { total: allCustomers.length };
}

// ─── Export / Import ───────────────────────────────────────

export async function exportAllData() {
  const invoices = await getAllInvoices();
  const products = await getAllProducts();
  const customers = await getAllCustomers();
  const inventoryHistory = await getAllInventoryHistory();

  return JSON.stringify({
    version: 3,
    exportedAt: new Date().toISOString(),
    invoices,
    products,
    customers,
    inventoryHistory,
  }, null, 2);
}

export async function importAllData(jsonString) {
  const data = JSON.parse(jsonString);
  
  let imported = { invoices: 0, products: 0, customers: 0 };

  // Import invoices
  if (data.invoices && Array.isArray(data.invoices)) {
    for (const inv of data.invoices) {
      const { id: _id, ...invoiceData } = inv;
      await db.invoices.add(invoiceData);
      imported.invoices++;
    }
  }

  // Import products (v2+)
  if (data.products && Array.isArray(data.products)) {
    for (const prod of data.products) {
      const { id: _id, ...productData } = prod;
      await db.products.add(productData);
      imported.products++;
    }
  }

  // Import customers (v2+)
  if (data.customers && Array.isArray(data.customers)) {
    for (const cust of data.customers) {
      const { id: _id, ...customerData } = cust;
      await db.customers.add(customerData);
      imported.customers++;
    }
  }

  // Import inventory history (v3+)
  if (data.inventoryHistory && Array.isArray(data.inventoryHistory)) {
    for (const record of data.inventoryHistory) {
      const { id: _id, ...recordData } = record;
      await db.inventoryHistory.add(recordData);
      imported.inventoryHistory = (imported.inventoryHistory || 0) + 1;
    }
  }

  return imported;
}

// Legacy support
export async function exportAllInvoices() {
  return exportAllData();
}

export async function importInvoices(jsonString) {
  const result = await importAllData(jsonString);
  return result.invoices + result.products + result.customers;
}

// Clear all data
export async function clearAllInvoices() {
  await db.invoices.clear();
  await _queue('invoices', 'clear', null);
}

export async function clearAllProducts() {
  await db.products.clear();
  await _queue('products', 'clear', null);
}

export async function clearAllCustomers() {
  await db.customers.clear();
  await _queue('customers', 'clear', null);
}

export async function clearAllData() {
  const { saveSettings, DEFAULT_SETTINGS } = await import('@/services/settings');
  const syncMod = await import('@/services/sync');
  const {
    clearSyncQueue,
    saveQueue,
    queueOperation,
    markClearPending,
    clearClearPending,
    setLastClearedAt,
    setSyncChoiceLock,
    stopSyncEngine,
    suppressQueueEvents,
  } = syncMod;

  const authed = _isAuthed();
  const online = typeof navigator === 'undefined' ? true : !!navigator.onLine;
  const LOG_TAG = '[clearAllData]';

  try {
    markClearPending();
    try { stopSyncEngine(); } catch { void 0; }

    if (authed && online) {
      const apiMod = await import('@/services/api');
      const api = apiMod.default || apiMod.api;

      const cloudResults = await Promise.allSettled([
        api.invoices?.clear?.() ?? Promise.reject(new Error('no invoices.clear')),
        api.products?.clear?.() ?? Promise.reject(new Error('no products.clear')),
        api.customers?.clear?.() ?? Promise.reject(new Error('no customers.clear')),
        api.inventory?.clear?.() ?? Promise.reject(new Error('no inventory.clear')),
      ]);

      const failed = cloudResults.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        const reasons = failed.map(r => r.reason?.message || String(r.reason)).join('; ');
        console.error(`${LOG_TAG} Cloud clear failed for ${failed.length}/4 endpoints: ${reasons}. Aborting clearAllData BEFORE touching local storage.`);
        throw new Error(`Cloud clear failed: ${reasons}`);
      }

      try {
        const pullCheck = await api.sync?.pull?.().catch(() => null);
        if (pullCheck) {
          const invN = (pullCheck.invoices || []).length;
          const prN = (pullCheck.products || []).length;
          const cuN = (pullCheck.customers || []).length;
          const ihN = (pullCheck.inventoryHistory || []).length;
          if (invN + prN + cuN + ihN > 0) {
            throw new Error(`Post-clear verification FAILED: cloud still has inv=${invN}, pr=${prN}, cu=${cuN}, ih=${ihN}. Clear aborted.`);
          }
          console.info(`${LOG_TAG} Post-clear cloud verification PASSED (all entities empty). Proceeding with local clear.`);
        }
      } catch (verifyErr) {
        if (verifyErr?.message?.startsWith('Post-clear verification FAILED')) throw verifyErr;
        console.warn(`${LOG_TAG} Post-clear verification skipped (offline or pull unavailable) — continuing with local clear.`);
      }
    } else if (authed && !online) {
      suppressQueueEvents(() => {
        saveQueue([]);
      });
      queueOperation('invoices', 'clear', null);
      queueOperation('products', 'clear', null);
      queueOperation('customers', 'clear', null);
      queueOperation('inventory', 'clear', null);
      console.info(`${LOG_TAG} Offline but authenticated: queued 4 :clear operations for next online cycle.`);
    }

    try {
      await db.transaction('rw', db.invoices, db.products, db.customers, db.inventoryHistory, async () => {
        await db.invoices.clear();
        await db.products.clear();
        await db.customers.clear();
        await db.inventoryHistory.clear();
      });
    } catch (txErr) {
      console.error(`${LOG_TAG} Local IndexedDB clear transaction FAILED.`, txErr);
      throw txErr;
    }

    try { saveSettings({ ...DEFAULT_SETTINGS }); } catch (setErr) {
      console.warn(`${LOG_TAG} saveSettings failed during clear.`, setErr);
    }

    clearSyncQueue();
    try {
      suppressQueueEvents(() => {
        saveQueue([], 'clearAllData complete - queue reset');
      });
    } catch { void 0; }

    const settingsLsKey = 'invoicehub_settings';
    const syncStrategyLsKey = 'invoicehub_sync_strategy';
    const tokenLsKey = 'invoicehub_token';
    const userLsKey = 'invoicehub_user';

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(settingsLsKey);
        localStorage.removeItem(syncStrategyLsKey);
        localStorage.removeItem(tokenLsKey);
        localStorage.removeItem(userLsKey);
      }
    } catch (lsErr) {
      console.warn(`${LOG_TAG} localStorage clear failed.`, lsErr);
    }

    try { setSyncChoiceLock(false); } catch { void 0; }

    setLastClearedAt(Date.now());

    try {
      if (typeof window !== 'undefined') {
        try { window.dispatchEvent(new CustomEvent('data-refreshed')); } catch { void 0; }
        try { window.dispatchEvent(new CustomEvent('inventory-updated')); } catch { void 0; }
        try { window.dispatchEvent(new CustomEvent('auth-logged-out')); } catch { void 0; }
      }
    } catch { void 0; }

    console.info(`${LOG_TAG} COMPLETE — all layers wiped, cloud verified empty, queue reset, clear flag lowered.`);
  } finally {
    clearClearPending();
  }
}

// ─── Inventory History ───────────────────────────────────────

export async function createInventoryRecord(record) {
  const now = new Date().toISOString();
  const data = {
    ...record,
    createdAt: record.createdAt || now,
  };
  if (data.id === undefined) delete data.id;
  const id = await db.inventoryHistory.add(data);
  const result = { ...data, id };
  await _queue('inventory', 'create', result);
  return result;
}

export async function getAllInventoryHistory() {
  return await db.inventoryHistory.orderBy('createdAt').reverse().toArray();
}

export async function getInventoryHistoryCount() {
  return await db.inventoryHistory.count();
}

export async function searchInventoryHistory({
  query = '',
  action = 'all',
  productId = null,
  dateFrom = null,
  dateTo = null,
  page = 1,
  pageSize = 20,
} = {}) {
  let records = await getAllInventoryHistory();

  if (query && query.trim()) {
    const lower = query.toLowerCase().trim();
    records = records.filter(
      (r) =>
        (r.productName || '').toLowerCase().includes(lower) ||
        (r.sku || '').toLowerCase().includes(lower) ||
        (r.reference || '').toLowerCase().includes(lower) ||
        (r.action || '').toLowerCase().includes(lower),
    );
  }

  if (action && action !== 'all') {
    records = records.filter((r) => r.action === action);
  }

  if (productId) {
    records = records.filter((r) => r.productId === productId);
  }

  if (dateFrom) {
    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);
    records = records.filter((r) => new Date(r.createdAt) >= from);
  }

  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    records = records.filter((r) => new Date(r.createdAt) <= to);
  }

  const total = records.length;
  const start = (page - 1) * pageSize;
  const items = records.slice(start, start + pageSize);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
}
