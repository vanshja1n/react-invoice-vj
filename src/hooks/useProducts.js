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
  // Prevents concurrent / redundant refresh calls from producing duplicate
  // IndexedDB reads and duplicate React state updates.
  // When a refresh is already in flight any new call just returns the same
  // promise, so multiple callers (e.g. mutation handler + data-refreshed event)
  // always collapse into one read.
  const _refreshPromiseRef = useRef(null);

  const _readData = useCallback(async () => {
    const data = await getAllProducts();
    setProducts(data);
    const s = await getProductStats();
    setStats(s);
    return { data, stats: s };
  }, []);

  const refresh = useCallback(async () => {
    // Deduplicate: if a refresh is already running, reuse its promise.
    if (_refreshPromiseRef.current) {
      console.log('[PRODUCTS-REFRESH] Skipped duplicate request');
      return _refreshPromiseRef.current;
    }
    console.log('[PRODUCTS-REFRESH] Started');
    setLoading(true);
    const promise = _readData()
      .then((result) => {
        console.log('[PRODUCTS-REFRESH] Completed', { productCount: result?.data?.length ?? 0 });
        return result;
      })
      .catch((e) => {
        console.error('[PRODUCTS-REFRESH] Failed to load products:', e);
      })
      .finally(() => {
        _refreshPromiseRef.current = null;
        setLoading(false);
      });
    _refreshPromiseRef.current = promise;
    return promise;
  }, [_readData]);

  const silentRefresh = useCallback(async () => {
    // Same deduplication — silentRefresh and refresh share the same in-flight
    // slot so a data-refreshed event that fires while a mutation refresh is
    // already running doesn't trigger a second read.
    if (_refreshPromiseRef.current) {
      console.log('[PRODUCTS-REFRESH] Skipped duplicate request (silent)');
      return _refreshPromiseRef.current;
    }
    const promise = _readData()
      .catch((e) => { console.error('Failed to load products:', e); })
      .finally(() => { _refreshPromiseRef.current = null; });
    _refreshPromiseRef.current = promise;
    return promise;
  }, [_readData]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => silentRefresh();
    window.addEventListener('data-refreshed', handler);
    return () => {
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
      
      // CRITICAL FIX: Validate product data before creation
      if (data.sellingPrice === 0 && data.name) {
        console.warn('[useProducts.add] Product has sellingPrice 0', {
          productName: data.name,
          sku: data.sku
        });
        // Allow but warn - price can be 0 for free products
      }
      
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
      
      // CRITICAL FIX: Validate product data before update
      if (data.sellingPrice === 0 && data.name) {
        console.warn('[useProducts.update] Product has sellingPrice 0', {
          productId: id,
          productName: data.name
        });
        // Allow but warn - price can be 0 for free products
      }
      
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
