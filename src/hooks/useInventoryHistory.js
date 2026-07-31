import { useState, useEffect, useCallback } from 'react';
import { searchInventoryHistory } from '@/services/db';

export function useInventoryHistory() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
  const [filters, setFilters] = useState({
    query: '',
    action: 'all',
    productId: null,
    dateFrom: null,
    dateTo: null,
    page: 1,
    pageSize: 20,
  });

  const _fetchWithFilters = useCallback(async (overrideFilters = {}, { silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const merged = { ...filters, ...overrideFilters };
      const result = await searchInventoryHistory(merged);
      setRecords(result.items);
      setPagination({
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      });
      if (Object.keys(overrideFilters).length > 0) {
        setFilters(merged);
      }
    } catch (e) {
      console.error('Failed to load inventory history:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters]);

  const fetchRecords = useCallback(async (overrideFilters = {}) => {
    return _fetchWithFilters(overrideFilters, { silent: false });
  }, [_fetchWithFilters]);

  const silentFetch = useCallback(async () => {
    return _fetchWithFilters({}, { silent: true });
  }, [_fetchWithFilters]);

  useEffect(() => {
    fetchRecords();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = () => silentFetch();
    const handlerData = () => silentFetch();
    window.addEventListener('inventory-updated', handler);
    window.addEventListener('data-refreshed', handlerData);
    return () => {
      window.removeEventListener('inventory-updated', handler);
      window.removeEventListener('data-refreshed', handlerData);
    };
  }, [silentFetch]);

  const updateFilters = useCallback((newFilters) => {
    fetchRecords({ ...newFilters, page: newFilters.page || 1 });
  }, [fetchRecords]);

  const setPage = useCallback((page) => {
    fetchRecords({ page });
  }, [fetchRecords]);

  const refresh = useCallback(() => {
    fetchRecords();
  }, [fetchRecords]);

  return {
    records,
    loading,
    pagination,
    filters,
    updateFilters,
    setPage,
    refresh,
  };
}
