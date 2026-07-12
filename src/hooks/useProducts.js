import { useState, useEffect, useCallback } from 'react';
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

export function useProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllProducts();
      setProducts(data);
      const s = await getProductStats();
      setStats(s);
    } catch (e) {
      console.error('Failed to load products:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('inventory-updated', handler);
    return () => window.removeEventListener('inventory-updated', handler);
  }, [refresh]);

  const add = useCallback(async (data) => {
    const product = await createProduct(data);
    await logProductCreated(product);
    await refresh();
    window.dispatchEvent(new CustomEvent('inventory-updated'));
    return product;
  }, [refresh]);

  const update = useCallback(async (id, data) => {
    const oldProduct = await getProduct(id);
    const product = await updateProduct(id, data);

    if (oldProduct && data.currentStock !== undefined && data.currentStock !== oldProduct.currentStock) {
      await logManualStockUpdate(id, oldProduct.currentStock, data.currentStock);
    }

    await refresh();
    window.dispatchEvent(new CustomEvent('inventory-updated'));
    return product;
  }, [refresh]);

  const remove = useCallback(async (id) => {
    const product = await getProduct(id);
    if (product) {
      await logProductDeleted(product);
    }
    await deleteProduct(id);
    await refresh();
    window.dispatchEvent(new CustomEvent('inventory-updated'));
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
