import { useState, useEffect, useCallback } from 'react';
import {
  getAllUniqueCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomer,
  searchCustomers,
  getCustomerStats,
} from '@/services/db';

export function useCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  const _readData = useCallback(async () => {
    const data = await getAllUniqueCustomers();
    setCustomers(data);
    const s = await getCustomerStats();
    setStats(s);
    return { data, stats: s };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await _readData();
    } catch (e) {
      console.error('Failed to load customers:', e);
    } finally {
      setLoading(false);
    }
  }, [_readData]);

  const silentRefresh = useCallback(async () => {
    try {
      await _readData();
    } catch (e) {
      console.error('Failed to load customers:', e);
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
    const customer = await createCustomer(data);
    await refresh();
    return customer;
  }, [refresh]);

  const update = useCallback(async (id, data) => {
    const customer = await updateCustomer(id, data);
    await refresh();
    return customer;
  }, [refresh]);

  const remove = useCallback(async (id) => {
    await deleteCustomer(id);
    await refresh();
  }, [refresh]);

  const search = useCallback(async (query) => {
    setLoading(true);
    try {
      if (!query || query.trim() === '') {
        const data = await getAllUniqueCustomers();
        setCustomers(data);
      } else {
        const results = await searchCustomers(query);
        setCustomers(results);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    customers,
    loading,
    stats,
    refresh,
    add,
    update,
    remove,
    search,
    getCustomer,
  };
}
