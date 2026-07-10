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
    const invoice = await createInvoice(data);
    await refresh();
    return invoice;
  }, [refresh]);

  const update = useCallback(async (id, data) => {
    const invoice = await updateInvoice(id, data);
    await refresh();
    return invoice;
  }, [refresh]);

  const remove = useCallback(async (id) => {
    await deleteInvoice(id);
    await refresh();
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
      const filtered = status === 'all' ? all : all.filter(inv => inv.status === status);
      setInvoices(filtered);
    } finally {
      setLoading(false);
    }
  }, []);

  const sortInvoices = useCallback((field, direction = 'desc') => {
    setInvoices(prev => {
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
    sortInvoices,
    getInvoice,
    getLastInvoiceNumber,
    getMonthlyRevenue,
  };
}
