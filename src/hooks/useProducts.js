import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  searchProducts,
  getProductsByCategory,
  getProductStats,
  getLowStockProducts,
} from '@/services/db';
import {
  logProductCreated,
  logProductDeleted,
  logManualStockUpdate,
} from '@/services/inventoryService';

const LOG_CREATE = true;
function _logCreate(tag, payload) {
  if (!LOG_CREATE) return;
  try {
    console.info('[CREATE-DUPE-DEBUG]', tag, payload);
  } catch { void 0; }
}

export function useProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const _addBusyRef = useRef(false);
  const _updateBusyRef = useRef(new Map());
  const _removeBusyRef = useRef(new Set());

  const _readData = useCallback(async () => {
    const data = await getAllProducts();
    setProducts(data);
    const s = await getProductStats();
    setStats(s);
    return { data, stats: s };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      console.log('[PRODUCTS-REFRESH] Starting product refresh');
      const { data } = await _readData();
      console.log('[PRODUCTS-REFRESH] Product refresh completed', { 
        productCount: data?.length || 0 
      });
    } catch (e) {
      console.error('[PRODUCTS-REFRESH] Failed to load products:', e);
    } finally {
      setLoading(false);
    }
  }, [_readData]);

  const silentRefresh = useCallback(async () => {
    try {
      await _readData();
    } catch (e) {
      console.error('Failed to load products:', e);
    }
  }, [_readData]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => silentRefresh();
    const handlerInv = () => silentRefresh();
    window.addEventListener('inventory-updated', handlerInv);
    window.addEventListener('data-refreshed', handler);
    return () => {
      window.removeEventListener('inventory-updated', handlerInv);
      window.removeEventListener('data-refreshed', handler);
    };
  }, [silentRefresh]);

  const add = useCallback(async (data) => {
    if (_addBusyRef.current) {
      const reason = '[useProducts.add] SKIPPED duplicate create (busy)';
      _logCreate('products:add:skip', { reason, name: data?.name });
      throw new Error('Create product already in progress');
    }
    const requestId = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ts = new Date().toISOString();
    _addBusyRef.current = true;
    try {
      _logCreate('products:add:start', { timestamp: ts, requestId, name: data?.name, entityId: null });
      const product = await createProduct(data);
      _logCreate('products:add:done', { timestamp: new Date().toISOString(), requestId, name: product?.name, entityId: String(product?.id ?? '') });
      await logProductCreated(product);
      await refresh();
      window.dispatchEvent(new CustomEvent('inventory-updated'));
      return product;
    } catch (err) {
      _logCreate('products:add:error', { timestamp: new Date().toISOString(), requestId, error: err?.message || String(err) });
      throw err;
    } finally {
      _addBusyRef.current = false;
    }
  }, [refresh]);

  const update = useCallback(async (id, data) => {
    const key = String(id);
    if (_updateBusyRef.current.has(key)) {
      const reason = '[useProducts.update] SKIPPED duplicate update (busy)';
      _logCreate('products:update:skip', { reason, entityId: key });
      throw new Error(`Update product ${key} already in progress`);
    }
    const requestId = `prod_upd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    _updateBusyRef.current.set(key, true);
    try {
      _logCreate('products:update:start', { timestamp: new Date().toISOString(), requestId, entityId: key });
      const oldProduct = await getProduct(id);
      const product = await updateProduct(id, data);

      if (oldProduct && data.currentStock !== undefined && data.currentStock !== oldProduct.currentStock) {
        await logManualStockUpdate(id, oldProduct.currentStock, data.currentStock);
      }

      _logCreate('products:update:done', { timestamp: new Date().toISOString(), requestId, entityId: String(product?.id ?? key) });
      await refresh();
      window.dispatchEvent(new CustomEvent('inventory-updated'));
      return product;
    } catch (err) {
      _logCreate('products:update:error', { timestamp: new Date().toISOString(), requestId, entityId: key, error: err?.message || String(err) });
      throw err;
    } finally {
      _updateBusyRef.current.delete(key);
    }
  }, [refresh]);

  const remove = useCallback(async (id) => {
    const key = String(id);
    if (_removeBusyRef.current.has(key)) {
      const reason = '[useProducts.remove] SKIPPED duplicate delete (busy)';
      _logCreate('products:remove:skip', { reason, entityId: key });
      throw new Error(`Delete product ${key} already in progress`);
    }
    const requestId = `prod_del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    _removeBusyRef.current.add(key);
    try {
      _logCreate('products:remove:start', { timestamp: new Date().toISOString(), requestId, entityId: key });
      const product = await getProduct(id);
      if (product) {
        await logProductDeleted(product);
      }
      await deleteProduct(id);
      _logCreate('products:remove:done', { timestamp: new Date().toISOString(), requestId, entityId: key });
      await refresh();
      window.dispatchEvent(new CustomEvent('inventory-updated'));
    } catch (err) {
      _logCreate('products:remove:error', { timestamp: new Date().toISOString(), requestId, entityId: key, error: err?.message || String(err) });
      throw err;
    } finally {
      _removeBusyRef.current.delete(key);
    }
  }, [refresh]);

  const search = useCallback(async (query) => {
    setLoading(true);
    try {
      const results = await searchProducts(query);
      setProducts(results);
    } finally {
      setLoading(false);
    }
  }, []);

  const filterByCategory = useCallback(async (category) => {
    setLoading(true);
    try {
      const filtered = await getProductsByCategory(category);
      setProducts(filtered);
    } finally {
      setLoading(false);
    }
  }, []);
  
  const getLowStock = useCallback(async () => {
    return await getLowStockProducts();
  }, []);

  return {
    products,
    loading,
    stats,
    refresh,
    add,
    update,
    remove,
    search,
    filterByCategory,
    getProduct,
    getLowStock,
  };
}
