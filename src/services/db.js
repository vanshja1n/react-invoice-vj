import Dexie from 'dexie';
import { isOverdue } from '@/types/invoice';
import { generateSKU } from '@/types/product';

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
  return { ...data, id };
}

export async function updateInvoice(id, invoiceData) {
  const now = new Date().toISOString();
  const data = {
    ...invoiceData,
    updatedAt: now,
  };
  await db.invoices.update(id, data);
  return { ...data, id };
}

export async function deleteInvoice(id) {
  await db.invoices.delete(id);
}

export async function getInvoice(id) {
  return await db.invoices.get(id);
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
  return { ...data, id };
}

export async function updateProduct(id, productData) {
  const now = new Date().toISOString();
  const data = {
    ...productData,
    updatedAt: now,
  };
  await db.products.update(id, data);
  return { ...data, id };
}

export async function deleteProduct(id) {
  await db.products.delete(id);
}

export async function getProduct(id) {
  return await db.products.get(id);
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
  const product = await db.products.get(productId);
  if (!product) return null;

  const qty = parseInt(quantity, 10) || 0;
  if (qty <= 0) return product;

  const previousStock = product.currentStock;
  const newStock = Math.max(0, previousStock - qty);
  await db.products.update(productId, {
    currentStock: newStock,
    updatedAt: new Date().toISOString(),
  });
  return { ...product, previousStock, currentStock: newStock, quantityChanged: -qty };
}

export async function restoreProductStock(productId, quantity) {
  const product = await db.products.get(productId);
  if (!product) return null;

  const qty = parseInt(quantity, 10) || 0;
  if (qty <= 0) return product;

  const previousStock = product.currentStock;
  const newStock = previousStock + qty;
  await db.products.update(productId, {
    currentStock: newStock,
    updatedAt: new Date().toISOString(),
  });
  return { ...product, previousStock, currentStock: newStock, quantityChanged: qty };
}

export async function setProductStock(productId, newStock) {
  const product = await db.products.get(productId);
  if (!product) return null;

  const previousStock = product.currentStock;
  const stock = Math.max(0, parseInt(newStock, 10) || 0);
  await db.products.update(productId, {
    currentStock: stock,
    updatedAt: new Date().toISOString(),
  });
  return {
    ...product,
    previousStock,
    currentStock: stock,
    quantityChanged: stock - previousStock,
  };
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
  return { ...data, id };
}

export async function updateCustomer(id, customerData) {
  const now = new Date().toISOString();
  const data = {
    ...customerData,
    updatedAt: now,
  };
  await db.customers.update(id, data);
  return { ...data, id };
}

export async function deleteCustomer(id) {
  await db.customers.delete(id);
}

export async function getCustomer(id) {
  return await db.customers.get(id);
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
}

export async function clearAllProducts() {
  await db.products.clear();
}

export async function clearAllCustomers() {
  await db.customers.clear();
}

export async function clearAllData() {
  await db.invoices.clear();
  await db.products.clear();
  await db.customers.clear();
  await db.inventoryHistory.clear();
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
  return { ...data, id };
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
