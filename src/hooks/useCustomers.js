import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getAllUniqueCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomer,
  searchCustomers,
  getCustomerStats,
} from '@/services/db';

const LOG_CREATE = true;
function _logCreate(tag, payload) {
  if (!LOG_CREATE) return;
  try {
    console.info('[CREATE-DUPE-DEBUG]', tag, payload);
  } catch { void 0; }
}

export function useCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const _addBusyRef = useRef(false);
  const _updateBusyRef = useRef(new Map());
  const _removeBusyRef = useRef(new Set());

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
    if (_addBusyRef.current) {
      const reason = '[useCustomers.add] SKIPPED duplicate create (busy)';
      _logCreate('customers:add:skip', { reason, name: data?.name, email: data?.email });
      throw new Error('Create customer already in progress');
    }
    const requestId = `cust_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ts = new Date().toISOString();
    _addBusyRef.current = true;
    try {
      _logCreate('customers:add:start', { timestamp: ts, requestId, name: data?.name, email: data?.email, entityId: null });
      const customer = await createCustomer(data);
      _logCreate('customers:add:done', { timestamp: new Date().toISOString(), requestId, name: customer?.name, email: customer?.email, entityId: String(customer?.id ?? '') });
      await refresh();
      return customer;
    } catch (err) {
      _logCreate('customers:add:error', { timestamp: new Date().toISOString(), requestId, error: err?.message || String(err) });
      throw err;
    } finally {
      _addBusyRef.current = false;
    }
  }, [refresh]);

  const update = useCallback(async (id, data) => {
    const key = String(id);
    if (_updateBusyRef.current.has(key)) {
      const reason = '[useCustomers.update] SKIPPED duplicate update (busy)';
      _logCreate('customers:update:skip', { reason, entityId: key });
      throw new Error(`Update customer ${key} already in progress`);
    }
    const requestId = `cust_upd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    _updateBusyRef.current.set(key, true);
    try {
      _logCreate('customers:update:start', { timestamp: new Date().toISOString(), requestId, entityId: key });
      const customer = await updateCustomer(id, data);
      _logCreate('customers:update:done', { timestamp: new Date().toISOString(), requestId, entityId: String(customer?.id ?? key) });
      await refresh();
      return customer;
    } catch (err) {
      _logCreate('customers:update:error', { timestamp: new Date().toISOString(), requestId, entityId: key, error: err?.message || String(err) });
      throw err;
    } finally {
      _updateBusyRef.current.delete(key);
    }
  }, [refresh]);

  const remove = useCallback(async (id) => {
    const key = String(id);
    if (_removeBusyRef.current.has(key)) {
      const reason = '[useCustomers.remove] SKIPPED duplicate delete (busy)';
      _logCreate('customers:remove:skip', { reason, entityId: key });
      throw new Error(`Delete customer ${key} already in progress`);
    }
    const requestId = `cust_del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    _removeBusyRef.current.add(key);
    try {
      _logCreate('customers:remove:start', { timestamp: new Date().toISOString(), requestId, entityId: key });
      await deleteCustomer(id);
      _logCreate('customers:remove:done', { timestamp: new Date().toISOString(), requestId, entityId: key });
      await refresh();
    } catch (err) {
      _logCreate('customers:remove:error', { timestamp: new Date().toISOString(), requestId, entityId: key, error: err?.message || String(err) });
      throw err;
    } finally {
      _removeBusyRef.current.delete(key);
    }
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
