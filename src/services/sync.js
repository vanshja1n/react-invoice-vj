import Dexie from 'dexie';
import api from '@/services/api';
import {
  getAllInvoices, getAllProducts, getAllCustomers, getAllInventoryHistory,
} from '@/services/db';
import { getSettings } from '@/services/settings';

const SYNC_STRATEGY_KEY = 'invoicehub_sync_strategy';
const QUEUE_KEY = 'invoicehub_sync_queue';
const SETTINGS_KEY = 'invoicehub_settings';
const SYNC_LOCK_KEY = 'invoicehub_sync_lock_pending';
const idFromRemoteRegex = /^[0-9a-fA-F]{24}$/;

const LOG_TAG = '[InvoiceHub Sync]';
function _log(...args) {
  try { console.info(LOG_TAG, ...args); } catch { void 0; }
}

let _refreshTimer = null;
export function dispatchDataRefreshed(waitMs = 120) {
  try {
    if (_refreshTimer) {
      clearTimeout(_refreshTimer);
      _refreshTimer = null;
    }
    _refreshTimer = setTimeout(() => {
      _refreshTimer = null;
      try { window.dispatchEvent(new CustomEvent('data-refreshed')); } catch { void 0; }
    }, waitMs);
  } catch { void 0; }
}

export function settingsAreUserEdited(settings, defaults) {
  try {
    const a = settings || {};
    const b = defaults || {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (k === 'theme') continue;   // theme is a per-browser UX preference, NOT "business data"
      const av = a[k];
      const bv = b[k];
      const aNullish = av === undefined || av === null || av === '';
      const bNullish = bv === undefined || bv === null || bv === '';
      if (aNullish !== bNullish) return true;
      if (!aNullish && String(av) !== String(bv)) return true;
    }
    return false;
  } catch {
    return true;  // on any unexpected error, assume user may have edited
  }
}

export function setSyncChoiceLock(active) {
  try {
    if (active) {
      sessionStorage.setItem(SYNC_LOCK_KEY, '1');
    } else {
      sessionStorage.removeItem(SYNC_LOCK_KEY);
    }
  } catch { void 0; }
}

export function isSyncChoiceLocked() {
  try {
    return sessionStorage.getItem(SYNC_LOCK_KEY) === '1';
  } catch { return false; }
}

export async function isSyncChoiceUnresolved(hasDataLocal) {
  const hasData = typeof hasDataLocal === 'boolean'
    ? hasDataLocal
    : await hasLocalData();
  const strategy = getSyncStrategy();
  const authed = isAuthenticated();
  return authed && hasData && !strategy;
}

function isRemoteId(id) {
  if (!id) return false;
  return typeof id === 'string' && idFromRemoteRegex.test(id);
}

export async function getLocalDataCounts() {
  try {
    const [inv, prod, cust, invHist] = await Promise.all([
      getAllInvoices().catch(() => []),
      getAllProducts().catch(() => []),
      getAllCustomers().catch(() => []),
      getAllInventoryHistory().catch(() => []),
    ]);
    return {
      invoices: inv.length,
      products: prod.length,
      customers: cust.length,
      inventoryHistory: invHist.length,
      total: inv.length + prod.length + cust.length + invHist.length,
      invoicesData: inv,
      productsData: prod,
      customersData: cust,
      inventoryHistoryData: invHist,
    };
  } catch {
    return { invoices: 0, products: 0, customers: 0, inventoryHistory: 0, total: 0, invoicesData: [], productsData: [], customersData: [], inventoryHistoryData: [] };
  }
}

export async function getCloudDataCounts() {
  if (!isAuthenticated() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { invoices: 0, products: 0, customers: 0, inventoryHistory: 0, total: 0 };
  }
  try {
    const data = await api.sync.pull();
    return {
      invoices: (data.invoices || []).length,
      products: (data.products || []).length,
      customers: (data.customers || []).length,
      inventoryHistory: (data.inventoryHistory || []).length,
      total:
        (data.invoices || []).length +
        (data.products || []).length +
        (data.customers || []).length +
        (data.inventoryHistory || []).length,
    };
  } catch {
    return { invoices: 0, products: 0, customers: 0, inventoryHistory: 0, total: 0 };
  }
}

export function getSyncStrategy() {
  return localStorage.getItem(SYNC_STRATEGY_KEY) || null;
}

export function setSyncStrategy(strategy) {
  if (strategy) {
    localStorage.setItem(SYNC_STRATEGY_KEY, strategy);
  } else {
    localStorage.removeItem(SYNC_STRATEGY_KEY);
  }
}

export async function hasLocalData() {
  try {
    const [inv, prod, cust, invHist] = await Promise.all([
      getAllInvoices().catch(() => []),
      getAllProducts().catch(() => []),
      getAllCustomers().catch(() => []),
      getAllInventoryHistory().catch(() => []),
    ]);
    const { getSettings: _getS, DEFAULT_SETTINGS: _ds } = await import('@/services/settings');
    const s = _getS();
    const settingsEdited = settingsAreUserEdited(s, _ds);
    const hasEntities = (inv.length + prod.length + cust.length + invHist.length) > 0;
    const has = hasEntities || settingsEdited;
    if (has) {
      _log('Guest data found. Guest invoices:', inv.length,
        '| Guest products:', prod.length,
        '| Guest customers:', cust.length,
        '| Guest inventory history:', invHist.length,
        '| Guest settings edited:', settingsEdited);
    } else {
      _log('Guest data check: no guest data present locally (no entities, no edited settings).');
    }
    return has;
  } catch {
    return false;
  }
}

let _lastQueueSerialized = '';
try {
  _lastQueueSerialized = localStorage.getItem(QUEUE_KEY) || '';
} catch { void 0; }

export function getQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearSyncQueue() {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch { void 0; }
  _lastQueueSerialized = '';
  try {
    window.dispatchEvent(new CustomEvent('queue-changed'));
  } catch { void 0; }
}

function saveQueue(queue) {
  const serialized = JSON.stringify(queue);
  if (serialized === _lastQueueSerialized) {
    return;
  }
  _lastQueueSerialized = serialized;
  localStorage.setItem(QUEUE_KEY, serialized);
  window.dispatchEvent(new CustomEvent('queue-changed'));
}

export function queueOperation(entity, operation, data) {
  const queue = getQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    entity,
    operation,
    data,
    createdAt: new Date().toISOString(),
  });
  saveQueue(queue);
}

function isAuthenticated() {
  return !!localStorage.getItem('invoicehub_token');
}

async function runOp(entity, operation, data) {
  const token = localStorage.getItem('invoicehub_token');
  if (!token) return { skipped: true };

  const strip = (doc) => {
    if (!doc) return doc;
    if (Array.isArray(doc)) return doc.map(strip);
    const { id: _idAlias, _id, userId: _uid, __v, ...rest } = doc;
    void _idAlias; void _uid;
    return rest;
  };

  const getFullLocalDoc = async (entityName, localId) => {
    try {
      const dbMod = await import('@/services/db');
      const db = dbMod.default;
      const storeMap = {
        invoices: db.invoices,
        products: db.products,
        customers: db.customers,
        inventory: db.inventoryHistory,
      };
      const store = storeMap[entityName];
      if (!store) return null;
      const parsedId = isNaN(Number(localId)) ? localId : Number(localId);
      const doc = await store.get(parsedId);
      return doc || null;
    } catch {
      return null;
    }
  };

  const findRemoteIdForLocal = async (entityName, localDoc) => {
    if (!localDoc) return null;
    try {
      const remoteCandidates = await (async () => {
        const listFns = {
          invoices: api.invoices.getAll,
          products: api.products.getAll,
          customers: api.customers.getAll,
        };
        const fn = listFns[entityName];
        if (typeof fn !== 'function') return [];
        return (await fn()) || [];
      })();
      if (!remoteCandidates.length) return null;
      const same = (a, b) => {
        const sa = String(a || '').trim().toLowerCase();
        const sb = String(b || '').trim().toLowerCase();
        return !!sa && sa === sb;
      };
      switch (entityName) {
        case 'invoices': {
          const hit = remoteCandidates.find((r) => same(r.invoiceNumber, localDoc.invoiceNumber) || same(r._id, localDoc.id));
          return hit?._id || null;
        }
        case 'products': {
          const hit = remoteCandidates.find((r) => same(r.sku, localDoc.sku) || same(r.name, localDoc.name) || same(r._id, localDoc.id));
          return hit?._id || null;
        }
        case 'customers': {
          const hit = remoteCandidates.find((r) => same(r.email, localDoc.email) || same(r.name, localDoc.name) || same(r._id, localDoc.id));
          return hit?._id || null;
        }
        default:
          return null;
      }
    } catch {
      return null;
    }
  };

  switch (`${entity}:${operation}`) {
    case 'invoices:create': {
      const d = strip(data);
      await api.invoices.create(d);
      return;
    }
    case 'invoices:update': {
      const { id, ...rest } = data || {};
      if (isRemoteId(id)) {
        await api.invoices.update(id, strip(rest));
      } else {
        const full = await getFullLocalDoc('invoices', id);
        const payload = full ? strip(full) : strip(rest);
        await api.invoices.create(payload);
      }
      return;
    }
    case 'invoices:delete': {
      if (isRemoteId(data)) {
        await api.invoices.delete(data);
      } else {
        const full = await getFullLocalDoc('invoices', data);
        if (full && full.id && isRemoteId(full.id)) {
          await api.invoices.delete(full.id);
        } else if (full && full._id && isRemoteId(full._id)) {
          await api.invoices.delete(full._id);
        } else {
          const remoteMatch = await findRemoteIdForLocal('invoices', full);
          if (remoteMatch) {
            await api.invoices.delete(remoteMatch);
          }
        }
      }
      return;
    }
    case 'products:create': {
      await api.products.create(strip(data));
      return;
    }
    case 'products:update': {
      const { id, ...rest } = data || {};
      if (isRemoteId(id)) {
        await api.products.update(id, strip(rest));
      } else {
        const full = await getFullLocalDoc('products', id);
        const payload = full ? strip(full) : strip(rest);
        await api.products.create(payload);
      }
      return;
    }
    case 'products:delete': {
      if (isRemoteId(data)) {
        await api.products.delete(data);
      } else {
        const full = await getFullLocalDoc('products', data);
        if (full && full.id && isRemoteId(full.id)) {
          await api.products.delete(full.id);
        } else if (full && full._id && isRemoteId(full._id)) {
          await api.products.delete(full._id);
        } else {
          const remoteMatch = await findRemoteIdForLocal('products', full);
          if (remoteMatch) {
            await api.products.delete(remoteMatch);
          }
        }
      }
      return;
    }
    case 'customers:create': {
      await api.customers.create(strip(data));
      return;
    }
    case 'customers:update': {
      const { id, ...rest } = data || {};
      if (isRemoteId(id)) {
        await api.customers.update(id, strip(rest));
      } else {
        const full = await getFullLocalDoc('customers', id);
        const payload = full ? strip(full) : strip(rest);
        await api.customers.create(payload);
      }
      return;
    }
    case 'customers:delete': {
      if (isRemoteId(data)) {
        await api.customers.delete(data);
      } else {
        const full = await getFullLocalDoc('customers', data);
        if (full && full.id && isRemoteId(full.id)) {
          await api.customers.delete(full.id);
        } else if (full && full._id && isRemoteId(full._id)) {
          await api.customers.delete(full._id);
        } else {
          const remoteMatch = await findRemoteIdForLocal('customers', full);
          if (remoteMatch) {
            await api.customers.delete(remoteMatch);
          }
        }
      }
      return;
    }
    case 'invoices:clear':
    case 'products:clear':
    case 'customers:clear':
    case 'inventory:clear': {
      try {
        const clearMap = {
          'invoices:clear': api.invoices?.clear,
          'products:clear': api.products?.clear,
          'customers:clear': api.customers?.clear,
          'inventory:clear': api.inventory?.clear,
        };
        const fn = clearMap[`${entity}:${operation}`];
        if (typeof fn === 'function') {
          await fn();
        }
      } catch (clearErr) {
        console.warn(`${LOG_TAG} Clear op for ${entity}:${operation} failed — backend may not expose dedicated clear endpoint.`, clearErr?.message || clearErr);
      }
      return;
    }
    case 'inventory:create': {
      await api.inventory.create(strip(data));
      return;
    }
    case 'settings:update': {
      await api.settings.update(strip(data));
      return;
    }
    default:
      return;
  }
}

export async function processQueue() {
  if (!isAuthenticated()) return 0;
  if (!navigator.onLine) return getQueue().length;

  if (isSyncChoiceLocked()) {
    const qLen = getQueue().length;
    _log(`processQueue skipped (sync choice unresolved). Queue = ${qLen}. Guest data and queue preserved until user decides.`);
    return qLen;
  }
  const unresolved = await isSyncChoiceUnresolved();
  if (unresolved) {
    const qLen = getQueue().length;
    _log(`processQueue skipped (sync strategy unresolved, authed user has guest data). Queue = ${qLen}. Waiting for user merge decision.`);
    return qLen;
  }

  const queue = getQueue();
  if (queue.length === 0) return 0;

  _log(`processQueue started. Queue length = ${queue.length}.`);

  const remaining = [];
  let processed = 0;

  for (const item of queue) {
    try {
      const res = await runOp(item.entity, item.operation, item.data);
      if (res && res.skipped) {
        remaining.push(item);
      } else {
        processed++;
      }
    } catch (err) {
      const status = typeof err.status === 'number' ? err.status : null;
      const isOffline = err.message === 'OFFLINE' || status === 0;
      const isServerError = status && status >= 500 && status < 600;
      const isClientError = status && status >= 400 && status < 500;
      const isUnknown = status === null && !isOffline;

      if (isOffline) {
        remaining.push(item);
        break;
      } else if (isServerError || isUnknown) {
        console.warn(`${LOG_TAG} Queue op failed, will retry:`, { entity: item.entity, op: item.operation, status, message: err.message });
        remaining.push(item);
      } else if (isClientError) {
        console.error(
          `${LOG_TAG} Queue op permanently failed (client error, dropped):`,
          { itemId: item.id, entity: item.entity, op: item.operation, status, reason: err.message, data: item.data }
        );
      } else {
        console.warn(`${LOG_TAG} Queue op failed, will retry:`, err);
        remaining.push(item);
      }
    }
  }
  void processed;

  saveQueue(remaining);
  _log(`processQueue complete. Remaining queue length = ${remaining.length}. Dropped ops = ${queue.length - remaining.length}.`);
  return remaining.length;
}

export async function pullFromCloud(opts = {}) {
  const { force = false } = opts;
  if (!isAuthenticated()) return;
  if (!navigator.onLine) throw new Error('OFFLINE');

  if (!force && isSyncChoiceLocked()) {
    _log('pullFromCloud ABORTED: sync choice is locked (dialog open or pending). Guest data NOT cleared.');
    throw new Error('SYNC_LOCKED');
  }
  if (!force) {
    const unresolved = await isSyncChoiceUnresolved();
    if (unresolved) {
      _log('pullFromCloud ABORTED: sync strategy unresolved (authed user still has unmerged guest data). Guest data NOT cleared.');
      throw new Error('SYNC_LOCKED');
    }
  }

  _log('Cloud sync: pulling fresh snapshot from MongoDB…');
  const data = await api.sync.pull();

  const invCount = (data.invoices || []).length;
  const prodCount = (data.products || []).length;
  const custCount = (data.customers || []).length;
  const invHistCount = (data.inventoryHistory || []).length;
  const hasSettings = !!(data.settings && Object.keys(data.settings).length > 0);
  _log('Cloud invoices:', invCount, '| Cloud products:', prodCount, '| Cloud customers:', custCount, '| Cloud inventory history:', invHistCount, '| Cloud settings present:', hasSettings);

  const db = (await import('@/services/db')).default;
  const { saveSettings, getSettings: _getSettings, DEFAULT_SETTINGS } = await import('@/services/settings');

  const snapshotInvoices = await db.invoices.toArray();
  const snapshotProducts = await db.products.toArray();
  const snapshotCustomers = await db.customers.toArray();
  const snapshotInventory = await db.inventoryHistory.toArray();
  const snapshotSettings = _getSettings() || { ...DEFAULT_SETTINGS };
  const snapshotQueue = [...getQueue()];

  const restoreSnapshot = async (reason, err) => {
    console.warn(`${LOG_TAG} pullFromCloud partial write, ROLLING BACK Dexie snapshot. Reason: ${reason}`, err);
    try {
      await db.invoices.clear();
      await db.products.clear();
      await db.customers.clear();
      await db.inventoryHistory.clear();
      if (snapshotInvoices.length) await db.invoices.bulkAdd(snapshotInvoices);
      if (snapshotProducts.length) await db.products.bulkAdd(snapshotProducts);
      if (snapshotCustomers.length) await db.customers.bulkAdd(snapshotCustomers);
      if (snapshotInventory.length) await db.inventoryHistory.bulkAdd(snapshotInventory);
      saveSettings(snapshotSettings || { ...DEFAULT_SETTINGS });
      saveQueue(snapshotQueue);
    } catch (restoreErr) {
      console.error(`${LOG_TAG} Snapshot restore FAILED. Browser state now inconsistent — please refresh.`, restoreErr);
    }
  };

  try {
    await db.invoices.clear();
    await db.products.clear();
    await db.customers.clear();
    await db.inventoryHistory.clear();
  } catch (err) {
    await restoreSnapshot('failed to clear stores before write', err);
    throw err;
  }

  const toId = (doc) => {
    if (!doc) return doc;
    const { _id, __v, userId: _uid, ...rest } = doc;
    void _uid;
    return { ...rest, id: _id };
  };

  try {
    if (data.invoices?.length) {
      await db.invoices.bulkAdd(data.invoices.map(toId));
    }
    if (data.products?.length) {
      await db.products.bulkAdd(data.products.map(toId));
    }
    if (data.customers?.length) {
      await db.customers.bulkAdd(data.customers.map(toId));
    }
    if (data.inventoryHistory?.length) {
      await db.inventoryHistory.bulkAdd(data.inventoryHistory.map(toId));
    }
  } catch (err) {
    await restoreSnapshot('bulkAdd write to Dexie failed', err);
    throw err;
  }

  try {
    if (hasSettings) {
      const { _id, __v, userId: _suid, ...settingsRest } = data.settings;
      void _suid;
      saveSettings(settingsRest);
    }
  } catch (err) {
    await restoreSnapshot('failed to persist settings', err);
    throw err;
  }
  _log('Cloud sync finished. Snapshot written to IndexedDB. Cloud sync finished.');
}

export async function pushLocalToCloud() {
  if (!isAuthenticated()) return;
  if (!navigator.onLine) throw new Error('OFFLINE');

  const [invoices, products, customers, inventoryHistory] = await Promise.all([
    getAllInvoices(),
    getAllProducts(),
    getAllCustomers(),
    getAllInventoryHistory(),
  ]);

  const settings = getSettings();

  _log('Upload started. Pushing guest data to cloud. Local invoices:', invoices.length, '| Local products:', products.length, '| Local customers:', customers.length, '| Local inventory history:', inventoryHistory.length);

  await api.sync.push({
    invoices,
    products,
    customers,
    inventoryHistory,
    settings,
  });

  saveQueue([]);
  _log('Upload completed. Guest workspace has been uploaded to MongoDB and is now the source of truth. Cloud sync finished.');
}

export async function clearUserDataFromIndexedDB() {
  const db = (await import('@/services/db')).default;
  const { DEFAULT_SETTINGS, saveSettings } = await import('@/services/settings');
  await db.invoices.clear();
  await db.products.clear();
  await db.customers.clear();
  await db.inventoryHistory.clear();
  saveSettings({ ...DEFAULT_SETTINGS });
}

export async function clearWorkspaceForLogout() {
  _log('Logout: clearing workspace (UI only — MongoDB data is untouched). This wipes IndexedDB tables, settings localStorage, sync queue localStorage, and sync strategy.');
  try {
    const db = (await import('@/services/db')).default;
    const { DEFAULT_SETTINGS, saveSettings } = await import('@/services/settings');
    if (db) {
      try { await db.invoices.clear(); } catch { void 0; }
      try { await db.products.clear(); } catch { void 0; }
      try { await db.customers.clear(); } catch { void 0; }
      try { await db.inventoryHistory.clear(); } catch { void 0; }
      try { await db.syncQueue.clear(); } catch { void 0; }
    }
    saveSettings({ ...DEFAULT_SETTINGS });
  } catch {
    void 0;
  }
  try { localStorage.removeItem(SETTINGS_KEY); } catch { void 0; }
  try { localStorage.removeItem(QUEUE_KEY); } catch { void 0; }
  try { localStorage.removeItem(SYNC_STRATEGY_KEY); } catch { void 0; }
  try { setSyncChoiceLock(false); } catch { void 0; }
  _log('Guest storage cleared on logout.');
}

export async function isCloudEmpty() {
  if (!isAuthenticated()) return null;
  if (!navigator.onLine) return null;
  try {
    const data = await api.sync.pull();
    const invN = (data.invoices || []).length;
    const prodN = (data.products || []).length;
    const custN = (data.customers || []).length;
    const invHN = (data.inventoryHistory || []).length;
    let settingsEdited = false;
    if (data.settings && typeof data.settings === 'object' && Object.keys(data.settings).length > 0) {
      const { DEFAULT_SETTINGS: _ds } = await import('@/services/settings');
      const { _id, __v, userId: _uid, ...rest } = data.settings;
      void _uid;
      settingsEdited = settingsAreUserEdited(rest, _ds);
    }
    const empty = invN === 0 && prodN === 0 && custN === 0 && invHN === 0 && !settingsEdited;
    _log(empty
      ? `Cloud workspace check: empty (0 cloud account detected. Cloud invoices: ${invN} products: ${prodN} customers: ${custN} inventory: ${invHN} settings-edited:${settingsEdited}. Auto-uploading guest workspace is safe.`
      : `Cloud workspace check: NOT empty. Cloud invoices: ${invN} products: ${prodN} customers: ${custN} inventory history: ${invHN} settings-edited:${settingsEdited}. ${invN + prodN + custN + (settingsEdited ? 1 : 0) > 0 ? 'Merge required — dialog will open if guest data also exists.' : ''}`
    );
    return empty;
  } catch (err) {
    console.warn(`${LOG_TAG} isCloudEmpty check failed (offline or API down) — returning null. Treating as "need dialog".`, err);
    return null;
  }
}

export async function mergeLocalAndCloud() {
  if (!isAuthenticated()) return;
  if (!navigator.onLine) throw new Error('OFFLINE');

  const cloud = await api.sync.pull();
  const [localInvoices, localProducts, localCustomers, localInventory] = await Promise.all([
    getAllInvoices(),
    getAllProducts(),
    getAllCustomers(),
    getAllInventoryHistory(),
  ]);
  const localSettings = getSettings();

  _log('Merge required. Guest invoices:', localInvoices.length, '| Cloud invoices:', (cloud.invoices || []).length,
    '| Guest products:', localProducts.length, '| Cloud products:', (cloud.products || []).length,
    '| Guest customers:', localCustomers.length, '| Cloud customers:', (cloud.customers || []).length);

  const strip = (doc) => {
    if (!doc) return doc;
    if (Array.isArray(doc)) return doc.map(strip);
    const { _id, __v, userId: _muid, id: _mid, ...rest } = doc;
    void _muid; void _mid;
    return rest;
  };

  const mergeByKey = (local, remote, keyFn) => {
    const map = new Map();
    for (const item of remote || []) {
      map.set(keyFn(item), { ...item, _merged: true });
    }
    for (const item of local || []) {
      const key = keyFn(item);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...item, _local: true });
      } else {
        const localTs = new Date(item.updatedAt || item.createdAt || 0).getTime();
        const remoteTs = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        if (localTs > remoteTs) {
          map.set(key, { ...existing, ...item });
        }
      }
    }
    return Array.from(map.values());
  };

  const invKey = (i) => i.invoiceNumber || i.id || i._id;
  const prodKey = (p) => p.sku || p.name || p.id || p._id;
  const custKey = (c) => (c.email || '').toLowerCase() || (c.name || '').toLowerCase() || c.id || c._id;
  const invHistKey = (h) => `${h.productId}-${h.createdAt}-${h.action}`;

  const mergedInvoices = mergeByKey(localInvoices, cloud.invoices, invKey);
  const mergedProducts = mergeByKey(localProducts, cloud.products, prodKey);
  const mergedCustomers = mergeByKey(localCustomers, cloud.customers, custKey);
  const mergedInventory = mergeByKey(localInventory, cloud.inventoryHistory, invHistKey);

  const mergedSettings = { ...(cloud.settings || {}), ...localSettings };

  const db = (await import('@/services/db')).default;
  const { saveSettings, getSettings: _getSettings, DEFAULT_SETTINGS } = await import('@/services/settings');

  const snapshotInvoices = await db.invoices.toArray();
  const snapshotProducts = await db.products.toArray();
  const snapshotCustomers = await db.customers.toArray();
  const snapshotInventory = await db.inventoryHistory.toArray();
  const snapshotSettings = _getSettings() || { ...DEFAULT_SETTINGS };
  const snapshotQueue = [...getQueue()];
  const restoreSnapshot = async (reason, err) => {
    console.warn(`${LOG_TAG} mergeLocalAndCloud partial write, ROLLING BACK Dexie snapshot. Reason: ${reason}`, err);
    try {
      await db.invoices.clear();
      await db.products.clear();
      await db.customers.clear();
      await db.inventoryHistory.clear();
      if (snapshotInvoices.length) await db.invoices.bulkAdd(snapshotInvoices);
      if (snapshotProducts.length) await db.products.bulkAdd(snapshotProducts);
      if (snapshotCustomers.length) await db.customers.bulkAdd(snapshotCustomers);
      if (snapshotInventory.length) await db.inventoryHistory.bulkAdd(snapshotInventory);
      saveSettings(snapshotSettings || { ...DEFAULT_SETTINGS });
      saveQueue(snapshotQueue);
    } catch (restoreErr) {
      console.error(`${LOG_TAG} Merge snapshot restore FAILED. Browser state now inconsistent — please refresh.`, restoreErr);
    }
  };

  try {
    await db.invoices.clear();
    await db.products.clear();
    await db.customers.clear();
    await db.inventoryHistory.clear();
  } catch (err) {
    await restoreSnapshot('failed to clear stores before merged write', err);
    throw err;
  }

  const toId = (doc) => {
    if (!doc) return doc;
    const { _id, __v, userId: _m2uid, _merged, _local, ...rest } = doc;
    void _m2uid;
    return { ...rest, id: _id || rest.id };
  };

  try {
    if (mergedInvoices.length) await db.invoices.bulkAdd(mergedInvoices.map(toId));
    if (mergedProducts.length) await db.products.bulkAdd(mergedProducts.map(toId));
    if (mergedCustomers.length) await db.customers.bulkAdd(mergedCustomers.map(toId));
    if (mergedInventory.length) await db.inventoryHistory.bulkAdd(mergedInventory.map(toId));
  } catch (err) {
    await restoreSnapshot('merged bulkAdd write to Dexie failed', err);
    throw err;
  }

  try {
    const { _id: _sid, __v: _sv, userId: _suid, ...settingsRest } = mergedSettings;
    void _sid; void _sv; void _suid;
    saveSettings(settingsRest);
  } catch (err) {
    await restoreSnapshot('failed to persist merged settings', err);
    throw err;
  }

  try {
    await api.sync.push({
      invoices: mergedInvoices.map(strip),
      products: mergedProducts.map(strip),
      customers: mergedCustomers.map(strip),
      inventoryHistory: mergedInventory.map(strip),
      settings: strip(mergedSettings),
    });
  } catch (err) {
    await restoreSnapshot('merged push to cloud failed', err);
    throw err;
  }

  saveQueue([]);
  _log('Merge completed. Merged invoices:', mergedInvoices.length,
    '| Merged products:', mergedProducts.length,
    '| Merged customers:', mergedCustomers.length,
    '. Guest storage cleared (now re-populated with merged snapshot). Cloud sync finished.');
}

export async function initialSyncOnLogin(strategy) {
  _log(`initialSyncOnLogin called with strategy: ${strategy}`);
  switch (strategy) {
    case 'merge':
      await mergeLocalAndCloud();
      break;
    case 'local':
      break;
    case 'replace-cloud':
      await pushLocalToCloud();
      break;
    case 'cloud':
      await pullFromCloud();
      break;
    default:
      break;
  }
  _log(`initialSyncOnLogin complete for strategy: ${strategy}`);
}

export async function getSyncDecision(cloudPullSnapshot = null) {
  // --- Guest (local) side ---
  const [localInvoices, localProducts, localCustomers, localInventoryHistory] =
    await Promise.all([
      getAllInvoices().catch(() => []),
      getAllProducts().catch(() => []),
      getAllCustomers().catch(() => []),
      getAllInventoryHistory().catch(() => []),
    ]);
  const { getSettings: _getS, DEFAULT_SETTINGS: _ds } = await import('@/services/settings');
  const localSettings = _getS();
  const localSettingsEdited = settingsAreUserEdited(localSettings, _ds);
  const guestDataExists =
    localInvoices.length > 0 ||
    localProducts.length > 0 ||
    localCustomers.length > 0 ||
    localSettingsEdited;

  // --- Cloud side ---
  let cloud = cloudPullSnapshot;
  if (!cloud) {
    if (isAuthenticated() && (typeof navigator === 'undefined' || navigator.onLine)) {
      try { cloud = await api.sync.pull(); } catch { cloud = null; }
    }
  }
  const cloudInvoices = (cloud?.invoices || []);
  const cloudProducts = (cloud?.products || []);
  const cloudCustomers = (cloud?.customers || []);
  const cloudSettings = cloud?.settings || null;
  let cloudSettingsEdited = false;
  if (cloudSettings && typeof cloudSettings === 'object' && Object.keys(cloudSettings).length > 0) {
    const { _id, __v, userId: _uid, ...rest } = cloudSettings;
    void _uid;
    cloudSettingsEdited = settingsAreUserEdited(rest, _ds);
  }
  const cloudDataExists =
    cloudInvoices.length > 0 ||
    cloudProducts.length > 0 ||
    cloudCustomers.length > 0 ||
    cloudSettingsEdited;

  const mergeRequired = guestDataExists && cloudDataExists;

  let action;
  if (!guestDataExists && !cloudDataExists) action = 'empty-workspace';
  else if (!guestDataExists && cloudDataExists) action = 'load-cloud';
  else if (guestDataExists && !cloudDataExists) action = 'upload-guest';
  else action = 'merge';

  const actionLabel = (() => {
    switch (action) {
      case 'load-cloud':      return 'Load Cloud';
      case 'upload-guest':    return 'Upload Guest';
      case 'merge':           return 'Merge';
      case 'empty-workspace': return 'Empty Workspace';
      default:                return String(action);
    }
  })();

  _log(
    '\n' +
    '────────────────────────── Sync Decision ──────────────────────────\n' +
    `Guest invoices:       ${localInvoices.length}\n` +
    `Guest products:       ${localProducts.length}\n` +
    `Guest customers:      ${localCustomers.length}\n` +
    `Guest history (inv):  ${localInventoryHistory.length}\n` +
    `Guest settings exist: ${localSettingsEdited}\n` +
    `---\n` +
    `Cloud invoices:       ${cloudInvoices.length}\n` +
    `Cloud products:       ${cloudProducts.length}\n` +
    `Cloud customers:      ${cloudCustomers.length}\n` +
    `Cloud settings exist: ${cloudSettingsEdited}\n` +
    `---\n` +
    `Guest data exists:    ${guestDataExists}\n` +
    `Cloud data exists:    ${cloudDataExists}\n` +
    `Merge required:       ${mergeRequired}\n` +
    `Chosen sync action:   ${actionLabel}\n` +
    '───────────────────────────────────────────────────────────────────\n'
  );

  const localCounts = {
    invoices: localInvoices.length,
    products: localProducts.length,
    customers: localCustomers.length,
    inventoryHistory: localInventoryHistory.length,
    total: localInvoices.length + localProducts.length + localCustomers.length + localInventoryHistory.length,
    settingsEdited: localSettingsEdited,
  };
  const cloudCounts = {
    invoices: cloudInvoices.length,
    products: cloudProducts.length,
    customers: cloudCustomers.length,
    inventoryHistory: (cloud?.inventoryHistory || []).length,
    total: cloudInvoices.length + cloudProducts.length + cloudCustomers.length + (cloud?.inventoryHistory || []).length,
    settingsEdited: cloudSettingsEdited,
  };

  return {
    action,
    guestDataExists,
    cloudDataExists,
    mergeRequired,
    localCounts,
    cloudCounts,
    snapshot: cloud,
  };
}
