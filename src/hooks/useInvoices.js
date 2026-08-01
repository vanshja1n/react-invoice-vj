import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getAllInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getInvoice,
  searchInvoices,
  getInvoiceStats,
  getMonthlyRevenue,
  getLastInvoiceNumber,
  normalizeId,
} from '@/services/db';
import {
  handleInvoiceStockUpdate,
  handleInvoiceDelete,
} from '@/services/inventoryService';
import { isOverdue } from '@/types/invoice';

const LOG_CREATE = true;
function _logCreate(tag, payload) {
  if (!LOG_CREATE) return;
  try {
    console.info('[CREATE-DUPE-DEBUG]', tag, payload);
  } catch { void 0; }
}

export function useInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const _addBusyRef = useRef(false);
  const _updateBusyRef = useRef(new Map());
  const _removeBusyRef = useRef(new Set());

  const _readData = useCallback(async () => {
    const data = await getAllInvoices();
    setInvoices(data);
    const s = await getInvoiceStats();
    setStats(s);
    return { data, stats: s };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await _readData();
    } catch (e) {
      console.error('Failed to load invoices:', e);
    } finally {
      setLoading(false);
    }
  }, [_readData]);

  const silentRefresh = useCallback(async () => {
    try {
      await _readData();
    } catch (e) {
      console.error('Failed to load invoices:', e);
    }
  }, [_readData]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => silentRefresh();
    window.addEventListener('data-refreshed', handler);
    return () => window.removeEventListener('data-refreshed', handler);
  }, [silentRefresh]);

  const add = useCallback(async (data) => {
    if (_addBusyRef.current) {
      const reason = '[useInvoices.add] SKIPPED duplicate create (busy)';
      _logCreate('invoices:add:skip', { reason, invoiceNumber: data?.invoiceNumber });
      throw new Error('Create invoice already in progress');
    }
    const requestId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ts = new Date().toISOString();
    _addBusyRef.current = true;
    try {
      _logCreate('invoices:add:start', { timestamp: ts, requestId, invoiceNumber: data?.invoiceNumber, entityId: null });
      await handleInvoiceStockUpdate(null, data);
      const invoice = await createInvoice(data);
      _logCreate('invoices:add:done', { timestamp: new Date().toISOString(), requestId, invoiceNumber: invoice?.invoiceNumber, entityId: String(invoice?.id ?? '') });
      await refresh();
      window.dispatchEvent(new CustomEvent('inventory-updated'));
      return invoice;
    } catch (err) {
      _logCreate('invoices:add:error', { timestamp: new Date().toISOString(), requestId, error: err?.message || String(err) });
      throw err;
    } finally {
      _addBusyRef.current = false;
    }
  }, [refresh]);

  const update = useCallback(async (id, data) => {
    const key = String(id);
    if (_updateBusyRef.current.has(key)) {
      const reason = '[useInvoices.update] SKIPPED duplicate update (busy)';
      _logCreate('invoices:update:skip', { reason, entityId: key });
      throw new Error(`Update invoice ${key} already in progress`);
    }
    const requestId = `inv_upd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    _updateBusyRef.current.set(key, true);
    try {
      _logCreate('invoices:update:start', { timestamp: new Date().toISOString(), requestId, entityId: key });
      const oldInvoice = await getInvoice(id);
      await handleInvoiceStockUpdate(oldInvoice, { ...oldInvoice, ...data, id });
      const invoice = await updateInvoice(id, data);
      _logCreate('invoices:update:done', { timestamp: new Date().toISOString(), requestId, entityId: String(invoice?.id ?? key) });
      await refresh();
      window.dispatchEvent(new CustomEvent('inventory-updated'));
      return invoice;
    } catch (err) {
      _logCreate('invoices:update:error', { timestamp: new Date().toISOString(), requestId, entityId: key, error: err?.message || String(err) });
      throw err;
    } finally {
      _updateBusyRef.current.delete(key);
    }
  }, [refresh]);

  const remove = useCallback(async (id) => {
    const key = String(id);
    if (_removeBusyRef.current.has(key)) {
      const reason = '[useInvoices.remove] SKIPPED duplicate delete (busy)';
      _logCreate('invoices:remove:skip', { reason, entityId: key });
      throw new Error(`Delete invoice ${key} already in progress`);
    }
    const requestId = `inv_del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    _removeBusyRef.current.add(key);
    try {
      _logCreate('invoices:remove:start', { timestamp: new Date().toISOString(), requestId, entityId: key });
      const invoice = await getInvoice(id);
      if (invoice) {
        await handleInvoiceDelete(invoice);
      }
      await deleteInvoice(id);
      _logCreate('invoices:remove:done', { timestamp: new Date().toISOString(), requestId, entityId: key });
      await refresh();
      window.dispatchEvent(new CustomEvent('inventory-updated'));
    } catch (err) {
      _logCreate('invoices:remove:error', { timestamp: new Date().toISOString(), requestId, entityId: key, error: err?.message || String(err) });
      throw err;
    } finally {
      _removeBusyRef.current.delete(key);
    }
  }, [refresh]);

  // Cancel an invoice: sets status to CANCELLED, restores any deducted stock,
  // persists the change locally (Dexie) and queues it for cloud sync.
  const cancel = useCallback(async (id) => {
    const key = String(id);
    if (_updateBusyRef.current.has(key)) {
      throw new Error(`Cancel invoice ${key} already in progress`);
    }
    _updateBusyRef.current.set(key, true);
    try {
      const existing = await getInvoice(id);
      if (!existing) throw new Error('Invoice not found');
      if (existing.status === 'cancelled') return existing; // idempotent

      // Restore stock that was deducted when this invoice was marked paid.
      await handleInvoiceStockUpdate(existing, { ...existing, status: 'cancelled', id });

      const updated = await updateInvoice(id, {
        ...existing,
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      });
      await refresh();
      window.dispatchEvent(new CustomEvent('inventory-updated'));
      return updated;
    } finally {
      _updateBusyRef.current.delete(key);
    }
  }, [refresh]);

  const search = useCallback(async (query) => {
    setLoading(true);
    try {
      const results = await searchInvoices(query);
      setInvoices(results);
    } finally {
      setLoading(false);
    }
  }, []);

  const filterByStatus = useCallback(async (status) => {
    setLoading(true);
    try {
      const all = await getAllInvoices();
      if (status === 'all') {
        setInvoices(all);
      } else if (status === 'overdue') {
        setInvoices(all.filter((inv) => isOverdue(inv)));
      } else {
        setInvoices(all.filter((inv) => inv.status === status && (status !== 'pending' && status !== 'sent' || !isOverdue(inv))));
      }
    } finally {
      setLoading(false);
    }
  }, []);
  
  const filterByDateRange = useCallback(async (start, end) => {
    setLoading(true);
    try {
      const all = await getAllInvoices();
      const filtered = all.filter((inv) => {
        const invDate = new Date(inv.issueDate);
        invDate.setHours(0, 0, 0, 0);
        return invDate >= start && invDate <= end;
      });
      setInvoices(filtered);
    } finally {
      setLoading(false);
    }
  }, []);

  const filterByCustomer = useCallback(async (customerId) => {
    setLoading(true);
    try {
      const all = await getAllInvoices();
      const target = normalizeId(customerId);
      const filtered = all.filter((inv) => normalizeId(inv.customerId) === target);
      setInvoices(filtered);
    } finally {
      setLoading(false);
    }
  }, []);

  const sortInvoices = useCallback((field, direction = 'desc') => {
    setInvoices((prev) => {
      const sorted = [...prev].sort((a, b) => {
        let aVal = a[field];
        let bVal = b[field];

        if (field === 'total' || field === 'amount') {
          // Handle both total and amount fields for consistency
          aVal = parseFloat(a.total || a.amount || 0);
          bVal = parseFloat(b.total || b.amount || 0);
        } else if (field === 'createdAt' || field === 'updatedAt') {
          aVal = new Date(aVal || 0).getTime();
          bVal = new Date(bVal || 0).getTime();
        } else {
          aVal = String(aVal || '').toLowerCase();
          bVal = String(bVal || '').toLowerCase();
        }

        if (direction === 'asc') return aVal > bVal ? 1 : -1;
        return aVal < bVal ? 1 : -1;
      });
      return sorted;
    });
  }, []);

  return {
    invoices,
    loading,
    stats,
    refresh,
    add,
    update,
    remove,
    cancel,
    search,
    filterByStatus,
    filterByDateRange,
    filterByCustomer,
    sortInvoices,
    getInvoice,
    getLastInvoiceNumber,
    getMonthlyRevenue,
  };
}
