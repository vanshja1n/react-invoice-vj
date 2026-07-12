import { useState, useEffect, useCallback } from 'react';
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
} from '@/services/db';
import {
  handleInvoiceStockUpdate,
  handleInvoiceDelete,
} from '@/services/inventoryService';
import { isOverdue } from '@/types/invoice';

export function useInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllInvoices();
      setInvoices(data);
      const s = await getInvoiceStats();
      setStats(s);
    } catch (e) {
      console.error('Failed to load invoices:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (data) => {
    await handleInvoiceStockUpdate(null, data);
    const invoice = await createInvoice(data);
    await refresh();
    window.dispatchEvent(new CustomEvent('inventory-updated'));
    return invoice;
  }, [refresh]);

  const update = useCallback(async (id, data) => {
    const oldInvoice = await getInvoice(id);
    await handleInvoiceStockUpdate(oldInvoice, { ...oldInvoice, ...data, id });
    const invoice = await updateInvoice(id, data);
    await refresh();
    window.dispatchEvent(new CustomEvent('inventory-updated'));
    return invoice;
  }, [refresh]);

  const remove = useCallback(async (id) => {
    const invoice = await getInvoice(id);
    if (invoice) {
      await handleInvoiceDelete(invoice);
    }
    await deleteInvoice(id);
    await refresh();
    window.dispatchEvent(new CustomEvent('inventory-updated'));
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
      const filtered = all.filter((inv) => inv.customerId === customerId);
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
          aVal = parseFloat(aVal || 0);
          bVal = parseFloat(bVal || 0);
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
