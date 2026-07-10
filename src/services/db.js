import Dexie from 'dexie';

// Create database
const db = new Dexie('InvoiceHubDB');

// Define schema
db.version(1).stores({
  invoices: '++id, invoiceNumber, status, clientName, companyName, amount, createdAt, updatedAt',
});

export default db;

// ─── CRUD Operations ───────────────────────────────────

export async function createInvoice(invoiceData) {
  const now = new Date().toISOString();
  const data = {
    ...invoiceData,
    createdAt: invoiceData.createdAt || now,
    updatedAt: now,
  };
  // Remove undefined id so Dexie auto-generates
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
      (inv.status || '').toLowerCase().includes(lower)
  );
}

// Filter by status
export async function filterInvoicesByStatus(status) {
  if (!status || status === 'all') return getAllInvoices();
  return await db.invoices.where('status').equals(status).reverse().sortBy('createdAt');
}

// Get stats for dashboard
export async function getInvoiceStats() {
  const all = await getAllInvoices();

  const stats = {
    total: all.length,
    paid: 0,
    pending: 0,
    draft: 0,
    totalRevenue: 0,
    paidRevenue: 0,
  };

  all.forEach((inv) => {
    const amount = parseFloat(inv.total || 0);
    stats.totalRevenue += amount;

    switch (inv.status) {
      case 'paid':
        stats.paid++;
        stats.paidRevenue += amount;
        break;
      case 'pending':
        stats.pending++;
        break;
      case 'draft':
        stats.draft++;
        break;
    }
  });

  return stats;
}

// Get monthly revenue data for charts
export async function getMonthlyRevenue() {
  const all = await getAllInvoices();
  const months = {};

  // Get last 12 months
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    months[key] = { month: label, revenue: 0, count: 0 };
  }

  all.forEach((inv) => {
    if (inv.createdAt) {
      const d = new Date(inv.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (months[key]) {
        months[key].revenue += parseFloat(inv.total || 0);
        months[key].count++;
      }
    }
  });

  return Object.values(months);
}

// Export all invoices as JSON
export async function exportAllInvoices() {
  const all = await getAllInvoices();
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), invoices: all }, null, 2);
}

// Import invoices from JSON
export async function importInvoices(jsonString) {
  const data = JSON.parse(jsonString);
  if (!data.invoices || !Array.isArray(data.invoices)) {
    throw new Error('Invalid backup file format');
  }

  let imported = 0;
  for (const inv of data.invoices) {
    // Remove the id so Dexie auto-generates new ones
    const { id: _id, ...invoiceData } = inv;
    await db.invoices.add(invoiceData);
    imported++;
  }

  return imported;
}

// Clear all invoices
export async function clearAllInvoices() {
  await db.invoices.clear();
}
