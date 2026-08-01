import Dexie from 'dexie';
import api from '@/services/api';
import {
  getAllInvoices, getAllProducts, getAllCustomers, getAllInventoryHistory,
  normalizeId,
} from '@/services/db';
import { getSettings } from '@/services/settings';

const SYNC_STRATEGY_KEY = 'invoicehub_sync_strategy';
const QUEUE_KEY = 'invoicehub_sync_queue';
const SETTINGS_KEY = 'invoicehub_settings';
const SYNC_LOCK_KEY = 'invoicehub_sync_lock_pending';
const CLEAR_PENDING_KEY = 'invoicehub_clear_pending_ts';
const LAST_CLEARED_KEY = 'invoicehub_last_cleared_ts';
const idFromRemoteRegex = /^[0-9a-fA-F]{24}$/;

const LOG_TAG = '[InvoiceHub Sync]';
function _log(level, subTag, ...args) {
  try {
    const ts = new Date().toISOString();
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
    fn(`${LOG_TAG} ${ts} [${subTag}]`, ...args);
  } catch { void 0; }
}

/* =============================================================
 * SECTION 1: SYNC MUTEX — singleton lock prevents overlap
 * ============================================================= */
const _syncMutex = { active: false, owner: null, startedAt: 0, token: 0 };
const MUTEX_TIMEOUT_MS = 60_000;
let _nextMutexToken = 1;

export function acquireSyncLock(owner) {
  const now = Date.now();
  if (_syncMutex.active) {
    if (now - _syncMutex.startedAt < MUTEX_TIMEOUT_MS) {
      _log('warn', 'MUTEX', `Lock busy — skipping [${owner}]. Held by [${_syncMutex.owner}] for ${(now - _syncMutex.startedAt) | 0}ms.`);
      return null;
    }
    _log('warn', 'MUTEX', `Stale lock detected from [${_syncMutex.owner}] (${(now - _syncMutex.startedAt) | 0}ms) — force-releasing.`);
  }
  const token = _nextMutexToken++;
  _syncMutex.active = true;
  _syncMutex.owner = owner;
  _syncMutex.startedAt = now;
  _syncMutex.token = token;
  _log('info', 'MUTEX', `Acquired by [${owner}] (token=${token}).`);
  return token;
}

export function releaseSyncLock(token, owner) {
  if (!_syncMutex.active) return;
  if (token !== null && token !== _syncMutex.token) return;
  const heldMs = Date.now() - _syncMutex.startedAt;
  _log('info', 'MUTEX', `Released by [${owner || _syncMutex.owner}] (token=${_syncMutex.token}, held=${heldMs}ms).`);
  _syncMutex.active = false;
  _syncMutex.owner = null;
  _syncMutex.startedAt = 0;
  _syncMutex.token = 0;
}

export function isSyncLocked() {
  if (!_syncMutex.active) return false;
  if (Date.now() - _syncMutex.startedAt < MUTEX_TIMEOUT_MS) return true;
  return false;
}

/* =============================================================
 * SECTION 2: DATA REFRESH DEBOUNCE (existing, preserved)
 * ============================================================= */
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
      _log('info', 'UI-DISPATCH', 'Dispatched data-refreshed event.');
    }, waitMs);
  } catch { void 0; }
}

export function settingsAreUserEdited(settings, defaults) {
  try {
    const a = settings || {};
    const b = defaults || {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (k === 'theme') continue;
      const av = a[k];
      const bv = b[k];
      const aNullish = av === undefined || av === null || av === '';
      const bNullish = bv === undefined || bv === null || bv === '';
      if (aNullish !== bNullish) return true;
      if (!aNullish && String(av) !== String(bv)) return true;
    }
    return false;
  } catch {
    return true;
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
      _log('info', 'LOCAL-CHECK', `Guest data found. invoices=${inv.length}, products=${prod.length}, customers=${cust.length}, invHist=${invHist.length}, settingsEdited=${settingsEdited}.`);
    } else {
      _log('info', 'LOCAL-CHECK', 'No guest data present locally.');
    }
    return has;
  } catch {
    return false;
  }
}

/* =============================================================
 * SECTION 3: QUEUE PERSISTENCE + DEDUP + SUPERSESSION
 * ============================================================= */
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
  _log('info', 'QUEUE', 'Queue cleared entirely (clearSyncQueue).');
}

let _queueEventSuppressed = 0;
export function suppressQueueEvents(fn) {
  _queueEventSuppressed++;
  try {
    return fn();
  } finally {
    _queueEventSuppressed = Math.max(0, _queueEventSuppressed - 1);
  }
}

function saveQueue(queue, reason = 'unspecified') {
  const serialized = JSON.stringify(queue);
  if (serialized === _lastQueueSerialized) {
    return;
  }
  const prevLen = _lastQueueSerialized
    ? (() => { try { return (JSON.parse(_lastQueueSerialized) || []).length; } catch { return -1; } })()
    : 0;
  _lastQueueSerialized = serialized;
  localStorage.setItem(QUEUE_KEY, serialized);
  if (_queueEventSuppressed === 0) {
    try {
      window.dispatchEvent(new CustomEvent('queue-changed'));
    } catch { void 0; }
  }
  _log('info', 'QUEUE-SAVE', `prevLen=${prevLen}, newLen=${queue.length}, reason=[${reason}], suppressed=${_queueEventSuppressed > 0}.`);
}

function _isClearOp(item) {
  return !!(item && item.operation === 'clear');
}

function _opTargetKey(entity, operation, data) {
  if (operation === 'clear') {
    return `${entity}:clear`;
  }
  let rawId;
  if (operation === 'delete') {
    rawId = data;
  } else {
    rawId = data && typeof data === 'object' ? data.id : undefined;
  }
  const canonicalId = (rawId === undefined || rawId === null)
    ? '__no_id__'
    : String(normalizeId(rawId));
  return `${entity}:${canonicalId}`;
}

function _payloadEqual(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

/* Apply queue supersession / scrubbing rules before adding a new op. Returns the (possibly modified) existing queue array. */
function _scrubQueueForNewOp(existingQueue, newEntity, newOp, newData) {
  const newTarget = _opTargetKey(newEntity, newOp, newData);
  const newIsClear = newOp === 'clear';
  const result = [];
  let mutated = false;
  for (const item of existingQueue) {
    const itemTarget = _opTargetKey(item.entity, item.operation, item.data);
    const itemIsClear = _isClearOp(item);

    if (newIsClear && item.entity === newEntity && !itemIsClear) {
      _log('info', 'QUEUE-SCRUB', `Dropping existing op ${item.entity}:${item.operation} [${item.id}] — new :clear op for same entity supersedes.`);
      mutated = true;
      continue;
    }

    if (newTarget !== itemTarget) {
      result.push(item);
      continue;
    }

    switch (`${item.operation}->${newOp}`) {
      case 'create->update': {
        const merged = {
          ...(item.data || {}),
          ...(newData || {}),
          id: (item.data && item.data.id !== undefined) ? item.data.id : (newData && newData.id),
        };
        result.push({ ...item, data: merged, updatedAt: new Date().toISOString() });
        mutated = true;
        _log('info', 'QUEUE-COALESCE', `${newEntity}: create + update → merged into single updated create [${item.id}].`);
        const remaining = existingQueue.slice(result.length);
        return { queue: [...result, ...remaining], skipAdd: true, mutated: true };
      }
      case 'update->update': {
        const merged = {
          ...(item.data || {}),
          ...(newData || {}),
          id: (item.data && item.data.id !== undefined) ? item.data.id : (newData && newData.id),
          updatedAt: new Date().toISOString(),
        };
        result.push({ ...item, data: merged, updatedAt: merged.updatedAt });
        mutated = true;
        _log('info', 'QUEUE-COALESCE', `${newEntity}: update + update → merged into single update [${item.id}].`);
        const remaining = existingQueue.slice(result.length);
        return { queue: [...result, ...remaining], skipAdd: true, mutated: true };
      }
      case 'create->delete': {
        mutated = true;
        _log('info', 'QUEUE-COALESCE', `${newEntity}: create [${item.id}] + incoming delete → BOTH DROPPED (no net change).`);
        continue;
      }
      case 'update->delete': {
        mutated = true;
        _log('info', 'QUEUE-COALESCE', `${newEntity}: update [${item.id}] + incoming delete → drop update, delete will be added separately.`);
        continue;
      }
      case 'create->create':
      case 'delete->delete': {
        if (_payloadEqual(item.data, newData)) {
          _log('info', 'QUEUE-DEDUP', `${newEntity}: duplicate ${newOp} payload → skip. Existing [${item.id}].`);
          return { queue: existingQueue, skipAdd: true, mutated: false };
        }
        result.push(item);
        continue;
      }
      default:
        result.push(item);
        continue;
    }
  }
  return { queue: result, skipAdd: false, mutated };
}

/* Public: scrub pending queue operations for an entity+id (used by delete-time scrubbing in db layer, before op is queued) */
export function scrubQueueForTarget(entity, targetId) {
  const q = getQueue();
  if (!q.length) return 0;
  const canonicalTarget = String(normalizeId(targetId));
  let removed = 0;
  const filtered = q.filter((item) => {
    if (item.entity !== entity) return true;
    if (_isClearOp(item)) return true;
    const itemKey = _opTargetKey(item.entity, item.operation, item.data);
    const match = itemKey.endsWith(`:${canonicalTarget}`) || itemKey.endsWith(`:${targetId}`);
    if (match) {
      removed++;
      _log('info', 'QUEUE-SCRUB-DELETE', `Removing pending op ${item.entity}:${item.operation} [${item.id}] — local target ${targetId} being deleted now.`);
      return false;
    }
    return true;
  });
  if (removed > 0) saveQueue(filtered, `scrubbed ${removed} ops before delete of ${entity}:${targetId}`);
  return removed;
}

export function queueOperation(entity, operation, data) {
  const newItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    entity,
    operation,
    data,
    createdAt: new Date().toISOString(),
  };
  _log('info', 'QUEUE-ADD', `Request: ${entity}:${operation}${operation === 'clear' ? '' : ` target=${(data && typeof data === 'object' ? data.id : String(data).slice(0, 32))}`}.`);

  const queue = getQueue();
  const { queue: scrubbed, skipAdd, mutated } = _scrubQueueForNewOp(queue, entity, operation, data);

  if (skipAdd) {
    if (mutated) saveQueue(scrubbed, `coalesced ${entity}:${operation} onto existing op`);
    return;
  }

  scrubbed.push(newItem);
  saveQueue(scrubbed, `added op ${entity}:${operation} [${newItem.id}]`);
}

/* =============================================================
 * SECTION 4: REMAP LOCAL ID → REMOTE OBJECTID AFTER CREATE
 * ============================================================= */
async function _rewriteLocalRecordWithRemoteId(entityName, oldLocalId, newRemoteId) {
  if (isRemoteId(oldLocalId)) return null;
  const nOld = normalizeId(oldLocalId);
  const db = (await import('@/services/db')).default;
  const storeMap = {
    invoices: db.invoices,
    products: db.products,
    customers: db.customers,
  };
  const store = storeMap[entityName];
  if (!store) return null;
  try {
    let rewritten = null;
    await db.transaction('rw', store, async () => {
      const existing = await store.get(nOld);
      if (!existing) {
        _log('warn', 'ID-REMAP', `${entityName}: local record ${JSON.stringify(oldLocalId)} not found — may have already been rewritten or cleared. Skipping.`);
        return;
      }
      rewritten = { ...existing, id: newRemoteId };
      await store.delete(nOld);
      await store.put(rewritten);
    });
    if (rewritten) {
      _log('info', 'ID-REMAP', `${entityName}: rewrote local primary key ${JSON.stringify(oldLocalId)} → ${newRemoteId} (MongoDB _id). Transactional.`);
    }
    return rewritten;
  } catch (err) {
    console.error(`${LOG_TAG} ID-REMAP ERROR ${entityName} ${JSON.stringify(oldLocalId)} → ${newRemoteId}:`, err);
    return null;
  }
}

function _patchRemainingQueueForRemap(entityName, oldLocalId, newRemoteId, partialQueue, fromIndex) {
  if (isRemoteId(oldLocalId)) return 0;
  const nOld = normalizeId(oldLocalId);
  const oldStr = String(nOld);
  let patched = 0;
  for (let i = fromIndex; i < partialQueue.length; i++) {
    const item = partialQueue[i];
    if (item.entity !== entityName) continue;
    if (_isClearOp(item)) continue;
    const op = item.operation;
    if (op === 'delete') {
      const dataIdStr = String(normalizeId(item.data));
      if (dataIdStr === oldStr) {
        item.data = newRemoteId;
        patched++;
      }
    } else if (op === 'create' || op === 'update') {
      const dataObj = item.data;
      if (dataObj && typeof dataObj === 'object') {
        const idStr = String(normalizeId(dataObj.id));
        if (idStr === oldStr) {
          dataObj.id = newRemoteId;
          patched++;
        }
      }
    }
  }
  if (patched > 0) {
    _log('info', 'QUEUE-ID-PATCH', `${entityName}: patched ${patched} remaining queue ops that referenced old local id ${JSON.stringify(oldLocalId)} → new remote id ${newRemoteId}.`);
  }
  return patched;
}

/* =============================================================
 * SECTION 5: QUEUE EXECUTION (runOp + processQueue)
 * ============================================================= */
function isAuthenticated() {
  return !!localStorage.getItem('invoicehub_token');
}

async function runOp(entity, operation, data, { remainingQueueSlice, currentIndex } = {}) {
  const token = localStorage.getItem('invoicehub_token');
  if (!token) return { skipped: true };

  const strip = (doc) => {
    if (!doc) return doc;
    if (Array.isArray(doc)) return doc.map(strip);
    const { id: _idAlias, _id, userId: _uid, __v, ...rest } = doc;
    void _idAlias; void _uid;
    
    // Preserve all invoice item fields exactly. Only coerce truly absent
    // values (null / undefined / empty-string) to safe numeric defaults so
    // MongoDB never receives NaN.  A value that is already a valid number —
    // including 0 (free / promotional items) — is passed through unchanged.
    if (rest.items && Array.isArray(rest.items)) {
      rest.items = rest.items.map(item => {
        const { price, tax, unit, ...itemRest } = item;
        const safeNum = (v, fallback = 0) => {
          if (v === null || v === undefined) return fallback;
          if (typeof v === 'string' && v.trim() === '') return fallback;
          const n = parseFloat(v);
          return isNaN(n) ? fallback : n;
        };
        return {
          ...itemRest,
          price: safeNum(price),
          tax: safeNum(tax),
          unit: (unit !== undefined && unit !== null) ? unit : 'pcs',
        };
      });
    }

    // Preserve both GST field names for cross-version compatibility.
    if (rest.companyGst !== undefined && !rest.gstNumber) {
      rest.gstNumber = rest.companyGst;
    }

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
      const parsedId = normalizeId(localId);
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

  const doCreateWithRemap = async (entityName, payload, createFn) => {
    _log('info', 'RUNOP-CREATE', `${entityName}: executing cloud create. Payload id=${payload && payload.id ? JSON.stringify(payload.id) : 'n/a'}.`);
    const created = await createFn(strip(payload));
    const remoteId = created && created._id ? created._id : null;
    const wasDeduped = created && created.dedupedOnServer === true;
    if (remoteId) {
      const oldLocalId = payload && payload.id;
      await _rewriteLocalRecordWithRemoteId(entityName, oldLocalId, remoteId);
      if (remainingQueueSlice && typeof currentIndex === 'number') {
        _patchRemainingQueueForRemap(entityName, oldLocalId, remoteId, remainingQueueSlice, currentIndex + 1);
      }
      _log('info', 'RUNOP-CREATE', `${entityName}: cloud create OK. remoteId=${remoteId}, backendDedup=${wasDeduped}.`);
      return { remoteId, remappedLocalId: !!oldLocalId && !isRemoteId(oldLocalId) };
    }
    return { remoteId, remappedLocalId: false };
  };

  switch (`${entity}:${operation}`) {
    case 'invoices:create': {
      await doCreateWithRemap('invoices', data, api.invoices.create);
      return;
    }
    case 'invoices:update': {
      const { id, ...rest } = data || {};
      if (isRemoteId(id)) {
        _log('info', 'RUNOP-UPDATE', `invoices: remote id=${id}, calling api.invoices.update.`);
        await api.invoices.update(id, strip(rest));
        return;
      }
      const full = await getFullLocalDoc('invoices', id);
      const payload = full ? strip(full) : strip(rest);
      if (full) {
        await doCreateWithRemap('invoices', full, api.invoices.create);
      } else {
        _log('warn', 'RUNOP-UPDATE', `invoices: local doc for id=${JSON.stringify(id)} missing. Heuristic create of partial payload. This may create a duplicate; backend dedup on invoiceNumber may catch it.`);
        await api.invoices.create(payload);
      }
      return;
    }
    case 'invoices:delete': {
      if (isRemoteId(data)) {
        _log('info', 'RUNOP-DELETE', `invoices: remote id=${data}, calling api.invoices.delete.`);
        try {
          await api.invoices.delete(data);
          return;
        } catch (err) {
          if (err && err.status === 404) {
            _log('info', 'RUNOP-DELETE', `invoices: remote id=${data} returned 404 — treating as idempotent success (doc already deleted on cloud).`);
            err._idempotentSuccess = true;
          }
          throw err;
        }
      }
      const full = await getFullLocalDoc('invoices', data);
      let targetRemoteId = null;
      if (full && full.id && isRemoteId(full.id)) targetRemoteId = full.id;
      else if (full && full._id && isRemoteId(full._id)) targetRemoteId = full._id;
      if (!targetRemoteId) targetRemoteId = await findRemoteIdForLocal('invoices', full);
      if (targetRemoteId) {
        _log('info', 'RUNOP-DELETE', `invoices: local id=${JSON.stringify(data)} → matched remote ${targetRemoteId} via ${full ? 'doc' : 'heuristic'}. Calling api.invoices.delete.`);
        try {
          await api.invoices.delete(targetRemoteId);
          return;
        } catch (err) {
          if (err && err.status === 404) {
            _log('info', 'RUNOP-DELETE', `invoices: remote id=${targetRemoteId} returned 404 → idempotent success.`);
            err._idempotentSuccess = true;
          }
          throw err;
        }
      }
      _log('warn', 'RUNOP-DELETE', `invoices: could not determine remote id for local id=${JSON.stringify(data)}. Dropping op (doc likely never synced or already cleared).`);
      return { droppedNoRemoteMatch: true };
    }

    case 'products:create': {
      await doCreateWithRemap('products', data, api.products.create);
      return;
    }
    case 'products:update': {
      const { id, ...rest } = data || {};
      if (isRemoteId(id)) {
        _log('info', 'RUNOP-UPDATE', `products: remote id=${id}, calling api.products.update.`);
        await api.products.update(id, strip(rest));
        return;
      }
      const full = await getFullLocalDoc('products', id);
      if (full) {
        await doCreateWithRemap('products', full, api.products.create);
      } else {
        _log('warn', 'RUNOP-UPDATE', `products: local doc for id=${JSON.stringify(id)} missing — falling back to partial heuristic create.`);
        await api.products.create(strip(rest));
      }
      return;
    }
    case 'products:delete': {
      if (isRemoteId(data)) {
        try {
          _log('info', 'RUNOP-DELETE', `products: remote id=${data}, calling api.products.delete.`);
          await api.products.delete(data);
          return;
        } catch (err) {
          if (err && err.status === 404) {
            _log('info', 'RUNOP-DELETE', `products: remote id=${data} 404 → idempotent success.`);
            err._idempotentSuccess = true;
          }
          throw err;
        }
      }
      const full = await getFullLocalDoc('products', data);
      let targetRemoteId = null;
      if (full && full.id && isRemoteId(full.id)) targetRemoteId = full.id;
      else if (full && full._id && isRemoteId(full._id)) targetRemoteId = full._id;
      if (!targetRemoteId) targetRemoteId = await findRemoteIdForLocal('products', full);
      if (targetRemoteId) {
        _log('info', 'RUNOP-DELETE', `products: local id=${JSON.stringify(data)} → matched remote ${targetRemoteId}. Deleting.`);
        try {
          await api.products.delete(targetRemoteId);
          return;
        } catch (err) {
          if (err && err.status === 404) {
            _log('info', 'RUNOP-DELETE', `products: remote id=${targetRemoteId} 404 → idempotent success.`);
            err._idempotentSuccess = true;
          }
          throw err;
        }
      }
      _log('warn', 'RUNOP-DELETE', `products: no remote match for local id=${JSON.stringify(data)}. Dropping op.`);
      return { droppedNoRemoteMatch: true };
    }

    case 'customers:create': {
      await doCreateWithRemap('customers', data, api.customers.create);
      return;
    }
    case 'customers:update': {
      const { id, ...rest } = data || {};
      if (isRemoteId(id)) {
        _log('info', 'RUNOP-UPDATE', `customers: remote id=${id}, calling api.customers.update.`);
        await api.customers.update(id, strip(rest));
        return;
      }
      const full = await getFullLocalDoc('customers', id);
      if (full) {
        await doCreateWithRemap('customers', full, api.customers.create);
      } else {
        _log('warn', 'RUNOP-UPDATE', `customers: local doc for id=${JSON.stringify(id)} missing — falling back to partial heuristic create.`);
        await api.customers.create(strip(rest));
      }
      return;
    }
    case 'customers:delete': {
      if (isRemoteId(data)) {
        try {
          _log('info', 'RUNOP-DELETE', `customers: remote id=${data}, calling api.customers.delete.`);
          await api.customers.delete(data);
          return;
        } catch (err) {
          if (err && err.status === 404) {
            _log('info', 'RUNOP-DELETE', `customers: remote id=${data} 404 → idempotent success.`);
            err._idempotentSuccess = true;
          }
          throw err;
        }
      }
      const full = await getFullLocalDoc('customers', data);
      let targetRemoteId = null;
      if (full && full.id && isRemoteId(full.id)) targetRemoteId = full.id;
      else if (full && full._id && isRemoteId(full._id)) targetRemoteId = full._id;
      if (!targetRemoteId) targetRemoteId = await findRemoteIdForLocal('customers', full);
      if (targetRemoteId) {
        _log('info', 'RUNOP-DELETE', `customers: local id=${JSON.stringify(data)} → matched remote ${targetRemoteId}. Deleting.`);
        try {
          await api.customers.delete(targetRemoteId);
          return;
        } catch (err) {
          if (err && err.status === 404) {
            _log('info', 'RUNOP-DELETE', `customers: remote id=${targetRemoteId} 404 → idempotent success.`);
            err._idempotentSuccess = true;
          }
          throw err;
        }
      }
      _log('warn', 'RUNOP-DELETE', `customers: no remote match for local id=${JSON.stringify(data)}. Dropping op.`);
      return { droppedNoRemoteMatch: true };
    }

    case 'invoices:clear':
    case 'products:clear':
    case 'customers:clear':
    case 'inventory:clear': {
      const clearMap = {
        'invoices:clear': api.invoices?.clear,
        'products:clear': api.products?.clear,
        'customers:clear': api.customers?.clear,
        'inventory:clear': api.inventory?.clear,
      };
      const fn = clearMap[`${entity}:${operation}`];
      if (typeof fn === 'function') {
        _log('info', 'RUNOP-CLEAR', `${entity}:${operation} — calling backend clear endpoint.`);
        await fn();
      } else {
        _log('warn', 'RUNOP-CLEAR', `${entity}:${operation} — no backend clear endpoint exposed; skipping (noop on cloud).`);
      }
      return;
    }
    case 'inventory:create': {
      _log('info', 'RUNOP-CREATE', `inventory: executing cloud create.`);
      await api.inventory.create(strip(data));
      return;
    }
    case 'settings:update': {
      _log('info', 'RUNOP-SETTINGS', `settings:update.`);
      await api.settings.update(strip(data));
      return;
    }
    default:
      _log('warn', 'RUNOP', `Unknown op ${entity}:${operation} — ignoring.`);
      return;
  }
}

export async function processQueue() {
  if (!isAuthenticated()) return 0;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return getQueue().length;

  if (isSyncChoiceLocked()) {
    const qLen = getQueue().length;
    _log('info', 'QUEUE-SKIP', `processQueue skipped (sync choice unresolved). Queue=${qLen}.`);
    return qLen;
  }
  const unresolved = await isSyncChoiceUnresolved();
  if (unresolved) {
    const qLen = getQueue().length;
    _log('info', 'QUEUE-SKIP', `processQueue skipped (sync strategy unresolved, authed user has guest data). Queue=${qLen}.`);
    return qLen;
  }

  const clearPendingTs = (() => {
    try {
      const raw = localStorage.getItem(CLEAR_PENDING_KEY);
      return raw ? Number(raw) || 0 : 0;
    } catch { return 0; }
  })();
  if (clearPendingTs > 0 && Date.now() - clearPendingTs < 60_000) {
    const qLen = getQueue().length;
    _log('info', 'QUEUE-SKIP', `processQueue skipped: Delete All Data in progress (pendingTs=${clearPendingTs}, age=${Date.now() - clearPendingTs}ms). Queue=${qLen}.`);
    return qLen;
  }

  const lockToken = acquireSyncLock('processQueue');
  if (lockToken === null) return getQueue().length;

  try {
    let rawQueue = getQueue();
    if (rawQueue.length === 0) return 0;

    let cleanedQueue = rawQueue.slice();
    const seenTargets = new Map();
    const MAX_AGE_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    cleanedQueue = cleanedQueue.filter((item) => {
      const age = now - new Date(item.createdAt || 0).getTime();
      if (age > MAX_AGE_MS && _isClearOp(item) === false) {
        _log('warn', 'QUEUE-STALE-DROP', `Dropping stale op ${item.entity}:${item.operation} [${item.id}], age=${age}ms > MAX_AGE.`);
        return false;
      }
      const tKey = _opTargetKey(item.entity, item.operation, item.data);
      if (seenTargets.has(tKey)) {
        const prev = seenTargets.get(tKey);
        if (prev.operation === item.operation && prev.entity === item.entity) {
          _log('warn', 'QUEUE-DEDUP-DROP', `Dropping duplicate queued op ${item.entity}:${item.operation} target=[${tKey}] itemId=${item.id} (prev itemId=${prev.id}).`);
          return false;
        }
      }
      seenTargets.set(tKey, item);
      return true;
    });

    if (cleanedQueue.length !== rawQueue.length) {
      suppressQueueEvents(() => {
        saveQueue(cleanedQueue, `processQueue pre-clean: dropped ${rawQueue.length - cleanedQueue.length} stale/duplicate entries.`);
      });
    }

    let queue = cleanedQueue;
    if (queue.length === 0) {
      try { window.dispatchEvent(new CustomEvent('queue-changed')); } catch { void 0; }
      return 0;
    }

    _log('info', 'PROCESS-QUEUE', `START. Queue length = ${queue.length} (after stale/dupe cleanup).`);

    const remaining = [];
    let processed = 0;
    let dropped = 0;
    let retried = 0;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      try {
        _log('info', 'OP-START', `[${i + 1}/${queue.length}] ${item.entity}:${item.operation} itemId=${item.id}.`);
        
        // CRITICAL FIX: Validate data integrity before processing
        if (item.operation === 'create' || item.operation === 'update') {
          let isCorrupted = false;
          let corruptionReason = '';
          
          // Validate invoices — only reject data that is structurally impossible.
          // price=0 is valid (free/promotional items). quantity=0 is invalid (nothing to invoice).
          if (item.entity === 'invoices' && item.data) {
            if (item.data.items && Array.isArray(item.data.items)) {
              const zeroQtyItems = item.data.items.filter(i => {
                const qty = typeof i.quantity === 'string' ? parseInt(i.quantity, 10) : i.quantity;
                return qty !== undefined && qty !== null && qty === 0 && !isNaN(qty);
              });

              if (zeroQtyItems.length > 0) {
                isCorrupted = true;
                corruptionReason = `${zeroQtyItems.length} invoice item(s) have quantity 0`;
              }
            }

            // Total of 0 with items only indicates corruption when ALL items also have quantity > 0 and price > 0.
            if (!isCorrupted && item.data.total === 0 && (item.data.items || []).length > 0) {
              const hasChargeable = item.data.items.some(i => {
                const qty = typeof i.quantity === 'string' ? parseInt(i.quantity, 10) : (i.quantity || 0);
                const price = typeof i.price === 'string' ? parseFloat(i.price) : (i.price || 0);
                return qty > 0 && price > 0;
              });
              if (hasChargeable) {
                isCorrupted = true;
                corruptionReason = 'Invoice total is 0 but chargeable items exist';
                _log('error', 'QUEUE-DATA-CORRUPTION', corruptionReason, { itemId: item.id });
              }
            }
          }
          
          // Validate products — only flag structurally impossible data.
          // sellingPrice=0 is valid (free product). Log it but don't block.
          if (item.entity === 'products' && item.data) {
            if (item.data.sellingPrice === 0 && item.data.name) {
              _log('info', 'QUEUE-PRODUCT-FREE', `Product "${item.data.name}" has sellingPrice=0 (free product — allowed).`, { itemId: item.id });
            }
            if (item.data.currentStock === 0 && item.data.name) {
              _log('info', 'QUEUE-STOCK-ZERO', `Product "${item.data.name}" has currentStock=0 (out-of-stock — allowed).`, { itemId: item.id });
            }
          }
          
          // Customers: no structural corruption checks needed — all fields optional.
          
          if (isCorrupted) {
            _log('error', 'QUEUE-DATA-CORRUPTION', `Skipping corrupted operation: ${corruptionReason}`, {
              entity: item.entity,
              operation: item.operation,
              itemId: item.id
            });
            dropped++;
            continue;
          }
        }
        
        const res = await runOp(item.entity, item.operation, item.data, { remainingQueueSlice: queue, currentIndex: i });
        if (res && res.skipped) {
          remaining.push(item);
        } else {
          processed++;
          _log('info', 'OP-OK', `[${i + 1}/${queue.length}] ${item.entity}:${item.operation} succeeded.`);
        }
      } catch (err) {
        if (err && err._idempotentSuccess) {
          processed++;
          _log('info', 'OP-OK', `[${i + 1}/${queue.length}] ${item.entity}:${item.operation} succeeded (idempotent; status=404 already-deleted).`);
          continue;
        }
        const status = typeof err.status === 'number' ? err.status : null;
        const isOffline = err.message === 'OFFLINE' || status === 0;
        const isServerError = status && status >= 500 && status < 600;
        const isClientError = status && status >= 400 && status < 500;
        const isUnknown = status === null && !isOffline;

        if (isOffline) {
          remaining.push(item);
          retried++;
          _log('warn', 'OP-RETRY', `[${i + 1}/${queue.length}] ${item.entity}:${item.operation} OFFLINE — kept in queue; halting further ops until back online.`);
          break;
        } else if (isServerError || isUnknown) {
          console.warn(`${LOG_TAG} OP-RETRY [${i + 1}/${queue.length}] ${item.entity}:${item.operation}:`, { status, message: err.message });
          remaining.push(item);
          retried++;
        } else if (isClientError) {
          dropped++;
          console.error(
            `${LOG_TAG} OP-DROP [${i + 1}/${queue.length}] Client error — permamently dropped ${item.entity}:${item.operation}:`,
            { itemId: item.id, status, reason: err.message, data: item.data }
          );
        } else {
          remaining.push(item);
          retried++;
          console.warn(`${LOG_TAG} OP-RETRY [${i + 1}/${queue.length}] ${item.entity}:${item.operation}:`, err);
        }
      }
    }

    suppressQueueEvents(() => {
      saveQueue(remaining, `processQueue complete (processed=${processed}, retried=${retried}, dropped=${dropped})`);
    });
    if (remaining.length > 0 || processed > 0 || dropped > 0) {
      try { window.dispatchEvent(new CustomEvent('queue-changed')); } catch { void 0; }
    }
    _log('info', 'PROCESS-QUEUE', `COMPLETE. processed=${processed}, retried=${retried}, dropped=${dropped}, remaining=${remaining.length}.`);
    return remaining.length;
  } finally {
    releaseSyncLock(lockToken, 'processQueue');
  }
}

/* =============================================================
 * SECTION 6: pullFromCloud — only if queue fully drained of non-clear ops
 * ============================================================= */
export async function pullFromCloud(opts = {}) {
  const { force = false } = opts;
  if (!isAuthenticated()) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('OFFLINE');

  if (!force && isSyncChoiceLocked()) {
    _log('warn', 'PULL', 'ABORTED: sync choice is locked (dialog open or pending).');
    throw new Error('SYNC_LOCKED');
  }
  if (!force) {
    const unresolved = await isSyncChoiceUnresolved();
    if (unresolved) {
      _log('warn', 'PULL', 'ABORTED: sync strategy unresolved (authed user still has unmerged guest data).');
      throw new Error('SYNC_LOCKED');
    }
  }

  const clearPendingTs = (() => {
    try {
      const raw = localStorage.getItem(CLEAR_PENDING_KEY);
      return raw ? Number(raw) || 0 : 0;
    } catch { return 0; }
  })();
  if (clearPendingTs > 0 && !force) {
    _log('warn', 'PULL', 'ABORTED: Delete All Data pending (clearPendingTs set). Use force=true to override.');
    throw new Error('CLEAR_PENDING');
  }

  if (!force) {
    const q = getQueue();
    const hasPendingNonClear = q.some((it) => !_isClearOp(it));
    if (hasPendingNonClear) {
      _log('warn', 'PULL', `ABORTED: queue still has ${q.length} op(s) including non-clear ops. Run processQueue first to avoid wiping referenced local records. Use force=true to override.`);
      throw new Error('QUEUE_NOT_DRAINED');
    }
  }

  const lockToken = acquireSyncLock('pullFromCloud');
  if (lockToken === null) return;

  try {
    _log('info', 'PULL', 'START — pulling fresh snapshot from MongoDB…');
    const data = await api.sync.pull();

    const invCount = (data.invoices || []).length;
    const prodCount = (data.products || []).length;
    const custCount = (data.customers || []).length;
    const invHistCount = (data.inventoryHistory || []).length;
    const hasSettings = !!(data.settings && Object.keys(data.settings).length > 0);
    _log('info', 'PULL-SNAPSHOT', `invoices=${invCount}, products=${prodCount}, customers=${custCount}, inventoryHistory=${invHistCount}, settingsPresent=${hasSettings}.`);

    const db = (await import('@/services/db')).default;
    const { saveSettings, getSettings: _getSettings, DEFAULT_SETTINGS } = await import('@/services/settings');

    const snapshotInvoices = await db.invoices.toArray();
    const snapshotProducts = await db.products.toArray();
    const snapshotCustomers = await db.customers.toArray();
    const snapshotInventory = await db.inventoryHistory.toArray();
    const snapshotSettings = _getSettings() || { ...DEFAULT_SETTINGS };
    const snapshotQueue = [...getQueue()];

    const restoreSnapshot = async (reason, err) => {
      console.warn(`${LOG_TAG} PULL-ROLLBACK — partial write detected. Reason: ${reason}`, err?.message || err);
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
        saveQueue(snapshotQueue, `rollback after pull partial failure: ${reason}`);
        _log('error', 'PULL-ROLLBACK', `Snapshot restored. Please verify UI and retry if needed.`);
      } catch (restoreErr) {
        console.error(`${LOG_TAG} PULL-ROLLBACK FAILED. Browser state now inconsistent — please refresh.`, restoreErr);
      }
    };

    // Map a MongoDB document into a Dexie-compatible record.
    // Rules:
    //  - Strip Mongo internals (_id, __v, userId) and set id = _id
    //  - Preserve ALL numeric values exactly, including 0 (free items, zero stock)
    //  - Only coerce truly absent values (null / undefined / empty-string) to 0
    //  - Preserve both GST field names for cross-version compatibility
    const safeNum = (v, fallback = 0) => {
      if (v === null || v === undefined) return fallback;
      if (typeof v === 'string' && v.trim() === '') return fallback;
      const n = parseFloat(v);
      return isNaN(n) ? fallback : n;
    };

    const toId = (doc) => {
      if (!doc) return doc;
      const { _id, __v, userId: _uid, ...rest } = doc;
      void _uid;

      if (rest.items && Array.isArray(rest.items)) {
        rest.items = rest.items.map(item => {
          const { price, tax, unit, ...itemRest } = item;
          return {
            ...itemRest,
            price: safeNum(price),
            tax: safeNum(tax),
            unit: (unit !== undefined && unit !== null) ? unit : 'pcs',
          };
        });
      }

      // Preserve both GST field names for cross-version compatibility.
      if (rest.gstNumber !== undefined && !rest.companyGst) {
        rest.companyGst = rest.gstNumber;
      }

      return { ...rest, id: _id };
    };

    const mappedInvoices = (data.invoices || []).map(toId);
    const mappedProducts = (data.products || []).map(toId);
    const mappedCustomers = (data.customers || []).map(toId);
    const mappedInventory = (data.inventoryHistory || []).map(toId);

    let settingsToSave = null;
    if (hasSettings) {
      const { _id, __v, userId: _suid, ...settingsRest } = data.settings;
      void _suid;
      settingsToSave = settingsRest;
    }

    try {
      await db.transaction('rw', db.invoices, db.products, db.customers, db.inventoryHistory, async () => {
        await db.invoices.clear();
        await db.products.clear();
        await db.customers.clear();
        await db.inventoryHistory.clear();
        if (mappedInvoices.length) await db.invoices.bulkAdd(mappedInvoices);
        if (mappedProducts.length) await db.products.bulkAdd(mappedProducts);
        if (mappedCustomers.length) await db.customers.bulkAdd(mappedCustomers);
        if (mappedInventory.length) await db.inventoryHistory.bulkAdd(mappedInventory);
      });
    } catch (err) {
      await restoreSnapshot('Dexie transaction (clear + bulkAdd) failed — snapshot restored.', err);
      throw err;
    }

    try {
      if (settingsToSave) {
        saveSettings(settingsToSave);
      }
    } catch (err) {
      await restoreSnapshot('failed to persist settings after successful Dexie transaction', err);
      throw err;
    }
    _log('info', 'PULL', `COMPLETE — snapshot written (atomic transaction). inv=${invCount}, prod=${prodCount}, cust=${custCount}, invHist=${invHistCount}.`);
  } finally {
    releaseSyncLock(lockToken, 'pullFromCloud');
  }
}

/* =============================================================
 * SECTION 7: Cloud push / merge / initial sync (refactored with mutex + logging)
 * ============================================================= */
export async function pushLocalToCloud() {
  if (!isAuthenticated()) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('OFFLINE');

  const lockToken = acquireSyncLock('pushLocalToCloud');
  if (lockToken === null) return;

  try {
    const [invoices, products, customers, inventoryHistory] = await Promise.all([
      getAllInvoices(),
      getAllProducts(),
      getAllCustomers(),
      getAllInventoryHistory(),
    ]);

    const settings = getSettings();

    _log('info', 'PUSH', `START — pushing guest workspace. invoices=${invoices.length}, products=${products.length}, customers=${customers.length}, inventoryHistory=${inventoryHistory.length}.`);

    await api.sync.push({
      invoices,
      products,
      customers,
      inventoryHistory,
      settings,
    });

    saveQueue([], `pushLocalToCloud complete — queue discarded (full workspace push replaces queue-per-op approach).`);
    _log('info', 'PUSH', 'COMPLETE — guest workspace uploaded to MongoDB as source of truth.');
  } finally {
    releaseSyncLock(lockToken, 'pushLocalToCloud');
  }
}

export async function clearUserDataFromIndexedDB() {
  const db = (await import('@/services/db')).default;
  const { DEFAULT_SETTINGS, saveSettings } = await import('@/services/settings');
  await db.invoices.clear();
  await db.products.clear();
  await db.customers.clear();
  await db.inventoryHistory.clear();
  saveSettings({ ...DEFAULT_SETTINGS });
  _log('info', 'LOCAL-WIPE', 'clearUserDataFromIndexedDB completed (tables + settings reset).');
}

export async function clearWorkspaceForLogout() {
  _log('info', 'LOGOUT-WIPE', 'Logout: clearing workspace (IndexedDB tables, settings localStorage, queue localStorage, sync strategy). MongoDB data untouched.');
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
  try { localStorage.removeItem(CLEAR_PENDING_KEY); } catch { void 0; }
  try { localStorage.removeItem(LAST_CLEARED_KEY); } catch { void 0; }
  try { setSyncChoiceLock(false); } catch { void 0; }
  _log('info', 'LOGOUT-WIPE', 'Logout wipe complete.');
}

export async function isCloudEmpty() {
  if (!isAuthenticated()) return null;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
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
    _log('info', 'CLOUD-EMPTY-CHECK', empty
      ? `Cloud workspace is EMPTY (inv=${invN}, prod=${prodN}, cust=${custN}, invHist=${invHN}, settingsEdited=${settingsEdited}). Safe to upload guest data.`
      : `Cloud workspace is NOT EMPTY (inv=${invN}, prod=${prodN}, cust=${custN}, invHist=${invHN}, settingsEdited=${settingsEdited}). Merge may be required.`);
    return empty;
  } catch (err) {
    console.warn(`${LOG_TAG} isCloudEmpty check failed — returning null (offline or API down).`, err);
    return null;
  }
}

export async function mergeLocalAndCloud() {
  if (!isAuthenticated()) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('OFFLINE');

  const lockToken = acquireSyncLock('mergeLocalAndCloud');
  if (lockToken === null) return;

  try {
    const cloud = await api.sync.pull();
    const [localInvoices, localProducts, localCustomers, localInventory] = await Promise.all([
      getAllInvoices(),
      getAllProducts(),
      getAllCustomers(),
      getAllInventoryHistory(),
    ]);
    const localSettings = getSettings();

    _log('info', 'MERGE', `START. guest_inv=${localInvoices.length}, cloud_inv=${(cloud.invoices || []).length}, guest_prod=${localProducts.length}, cloud_prod=${(cloud.products || []).length}, guest_cust=${localCustomers.length}, cloud_cust=${(cloud.customers || []).length}.`);

    const strip = (doc) => {
      if (!doc) return doc;
      if (Array.isArray(doc)) return doc.map(strip);
      const { _id, __v, userId: _muid, id: _mid, ...rest } = doc;
      void _muid; void _mid;

      if (rest.items && Array.isArray(rest.items)) {
        rest.items = rest.items.map(item => {
          const { price, tax, unit, ...itemRest } = item;
          const safeNum = (v, fallback = 0) => {
            if (v === null || v === undefined) return fallback;
            if (typeof v === 'string' && v.trim() === '') return fallback;
            const n = parseFloat(v);
            return isNaN(n) ? fallback : n;
          };
          return {
            ...itemRest,
            price: safeNum(price),
            tax: safeNum(tax),
            unit: (unit !== undefined && unit !== null) ? unit : 'pcs',
          };
        });
      }

      // Preserve both GST field names for cross-version compatibility.
      if (rest.companyGst !== undefined && !rest.gstNumber) {
        rest.gstNumber = rest.companyGst;
      }

      return rest;
    };

    const mergeByKey = (local, remote, keyFn) => {
      const map = new Map();

      // Deep merge: source fields overwrite target fields, except when the
      // source value is undefined or null (absent).  Numeric 0 IS a valid
      // business value (free items, zero discount, zero tax) and must always
      // be written through.
      const deepMerge = (target, source) => {
        const result = { ...target };

        for (const key of Object.keys(source)) {
          const sourceValue = source[key];

          // Skip truly absent values — preserve whatever target had.
          if (sourceValue === undefined || sourceValue === null) continue;

          // Special handling for invoice items array: merge by element index.
          if (key === 'items' && Array.isArray(sourceValue) && Array.isArray(result[key])) {
            result[key] = sourceValue.map((sourceItem, index) => {
              const targetItem = result[key][index];
              if (!targetItem) return sourceItem;
              // Merge item fields — 0 is a valid price/qty/tax/discount value.
              const mergedItem = { ...targetItem };
              for (const itemKey of Object.keys(sourceItem)) {
                const sv = sourceItem[itemKey];
                if (sv !== undefined && sv !== null) {
                  mergedItem[itemKey] = sv;
                }
              }
              return mergedItem;
            });
          } else {
            result[key] = sourceValue;
          }
        }

        return result;
      };
      
      // First, add all remote items
      for (const item of remote || []) {
        map.set(keyFn(item), { ...item, _merged: true });
      }
      
      // Then merge local items with proper conflict resolution
      for (const item of local || []) {
        const key = keyFn(item);
        const existing = map.get(key);
        
        if (!existing) {
          // Local-only item: preserve it completely
          map.set(key, { ...item, _local: true });
          _log('info', 'MERGE-LOCAL-ONLY', `key=${String(key).slice(0, 48)}: local item preserved (not in cloud).`);
        } else {
          // Conflict: use timestamp-based resolution with deep merge
          const localTs = new Date(item.updatedAt || item.createdAt || 0).getTime();
          const remoteTs = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
          
          if (localTs > remoteTs) {
            // Local is newer: deep merge local into remote, preserving all local fields
            const merged = deepMerge(existing, item);
            map.set(key, merged);
            _log('info', 'MERGE-WIN', `key=${String(key).slice(0, 48)}: local (ts=${localTs}) overwrote cloud (ts=${remoteTs}).`);
          } else if (remoteTs > localTs) {
            // Remote is newer: deep merge remote into local, preserving all local fields
            const merged = deepMerge(item, existing);
            map.set(key, merged);
            _log('info', 'MERGE-WIN', `key=${String(key).slice(0, 48)}: cloud (ts=${remoteTs}) merged into local (ts=${localTs}).`);
          } else {
            // Same timestamp: deep merge both, preferring local for conflicts
            const merged = deepMerge(existing, item);
            map.set(key, merged);
            _log('info', 'MERGE-SAME-TS', `key=${String(key).slice(0, 48)}: same timestamp, deep merge applied.`);
          }
        }
      }
      
      return Array.from(map.values());
    };

    const invKey = (i) => i.invoiceNumber || i.id || i._id;
    const prodKey = (p) => p.sku || p.name || p.id || p._id;
    const custKey = (c) => (c.email || '').toLowerCase() || (c.name || '').toLowerCase() || c.id || c._id;
    const invHistKey = (h) => `${h.productId}-${h.createdAt}-${h.action}`;

    console.log('[SYNC-MERGE] Starting merge', {
      localInvoices: localInvoices.length,
      cloudInvoices: cloud.invoices?.length,
      localProducts: localProducts.length,
      cloudProducts: cloud.products?.length,
      localCustomers: localCustomers.length,
      cloudCustomers: cloud.customers?.length
    });

    const mergedInvoices = mergeByKey(localInvoices, cloud.invoices, invKey);
    const mergedProducts = mergeByKey(localProducts, cloud.products, prodKey);
    const mergedCustomers = mergeByKey(localCustomers, cloud.customers, custKey);
    const mergedInventory = mergeByKey(localInventory, cloud.inventoryHistory, invHistKey);

    console.log('[SYNC-MERGE] Merge complete', {
      mergedInvoices: mergedInvoices.length,
      mergedProducts: mergedProducts.length,
      mergedCustomers: mergedCustomers.length,
      mergedInventory: mergedInventory.length
    });

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
      console.warn(`${LOG_TAG} MERGE-ROLLBACK. Reason: ${reason}`, err?.message || err);
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
        saveQueue(snapshotQueue, `rollback after merge partial failure: ${reason}`);
      } catch (restoreErr) {
        console.error(`${LOG_TAG} Merge snapshot restore FAILED. Browser state now inconsistent — please refresh.`, restoreErr);
      }
    };

    const toId = (doc) => {
      if (!doc) return doc;
      const { _id, __v, userId: _m2uid, _merged, _local, ...rest } = doc;
      void _m2uid;
      return { ...rest, id: _id || rest.id };
    };

    const txMappedInvoices = mergedInvoices.map(toId);
    const txMappedProducts = mergedProducts.map(toId);
    const txMappedCustomers = mergedCustomers.map(toId);
    const txMappedInventory = mergedInventory.map(toId);

    try {
      await db.transaction('rw', db.invoices, db.products, db.customers, db.inventoryHistory, async () => {
        await db.invoices.clear();
        await db.products.clear();
        await db.customers.clear();
        await db.inventoryHistory.clear();
        if (txMappedInvoices.length) await db.invoices.bulkAdd(txMappedInvoices);
        if (txMappedProducts.length) await db.products.bulkAdd(txMappedProducts);
        if (txMappedCustomers.length) await db.customers.bulkAdd(txMappedCustomers);
        if (txMappedInventory.length) await db.inventoryHistory.bulkAdd(txMappedInventory);
      });
    } catch (err) {
      await restoreSnapshot('merged Dexie transaction (clear + bulkAdd) failed — snapshot restored.', err);
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

    saveQueue([], `mergeLocalAndCloud complete — queue reset (full workspace push handles all local+cloud entities).`);
    _log('info', 'MERGE', `COMPLETE. merged_inv=${mergedInvoices.length}, merged_prod=${mergedProducts.length}, merged_cust=${mergedCustomers.length}.`);
  } finally {
    releaseSyncLock(lockToken, 'mergeLocalAndCloud');
  }
}

export async function initialSyncOnLogin(strategy) {
  _log('info', 'INITIAL-SYNC', `START — strategy=${strategy}.`);
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
  _log('info', 'INITIAL-SYNC', `COMPLETE — strategy=${strategy}.`);
}

/* =============================================================
 * SECTION 8: Delete All Data atomicity guards + helpers
 * ============================================================= */
export function markClearPending() {
  const ts = Date.now();
  try { localStorage.setItem(CLEAR_PENDING_KEY, String(ts)); } catch { void 0; }
  _log('info', 'CLEAR-ALL', `Clear pending flag SET (ts=${ts}).`);
}

export function clearClearPending() {
  try { localStorage.removeItem(CLEAR_PENDING_KEY); } catch { void 0; }
  _log('info', 'CLEAR-ALL', 'Clear pending flag CLEARED.');
}

export function setLastClearedAt(ts = Date.now()) {
  try { localStorage.setItem(LAST_CLEARED_KEY, String(ts)); } catch { void 0; }
  _log('info', 'CLEAR-ALL', `Last cleared timestamp SET (ts=${ts}).`);
}

export function getLastClearedAt() {
  try {
    const raw = localStorage.getItem(LAST_CLEARED_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch { return 0; }
}

/* =============================================================
 * SECTION 9: SINGLETON SYNC ENGINE — guarantees exactly one interval loop
 * ============================================================= */
const _singleton = {
  intervalId: null,
  startedAt: 0,
  running: false,
  lastRunAt: 0,
  lastPullAt: 0,   // timestamp of the last successful pullFromCloud
  debounceTimer: null,
};

// Minimum gap between successive cloud pulls in the engine tick.
// Prevents the 10 s interval from unconditionally wiping + rewriting Dexie
// while the user is actively creating / editing data.
const MIN_PULL_INTERVAL_MS = 30_000;

export function startSyncEngine(intervalMs = 10000) {
  if (!isAuthenticated()) {
    stopSyncEngine();
    return false;
  }
  if (_singleton.intervalId !== null) {
    _log('info', 'ENGINE', `Sync engine already running (pid=${_singleton.startedAt}). Ignoring duplicate start request.`);
    return false;
  }
  _singleton.running = true;
  _singleton.startedAt = Date.now();
  _singleton.lastRunAt = 0;
  _singleton.lastPullAt = 0;

  const tick = async () => {
    if (!isAuthenticated()) {
      stopSyncEngine();
      return;
    }
    if (isSyncLocked()) {
      _log('info', 'ENGINE', 'Tick — sync locked; skipping this run.');
      return;
    }
    _singleton.lastRunAt = Date.now();
    _log('info', 'ENGINE', 'Tick — processing queue…');
    try {
      const locked = isSyncChoiceLocked() || await isSyncChoiceUnresolved();
      if (locked) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      // 1. Drain the queue first.  Pull is only safe once all local writes
      //    have been committed to the cloud so we don't overwrite them.
      const remaining = await processQueue();

      // 2. Pull from cloud only when:
      //    a) The queue is fully drained (no pending writes).
      //    b) At least MIN_PULL_INTERVAL_MS has elapsed since the last pull.
      //    This prevents the engine from hammering Dexie with full
      //    clear+rewrite cycles while the user is actively working.
      const queueDrained = remaining === 0;
      const pullDue = (Date.now() - _singleton.lastPullAt) >= MIN_PULL_INTERVAL_MS;

      let pulled = false;
      if (queueDrained && pullDue) {
        try {
          await pullFromCloud();
          _singleton.lastPullAt = Date.now();
          pulled = true;
        } catch (_err) {
          // QUEUE_NOT_DRAINED, SYNC_LOCKED, OFFLINE, etc. — all safe to ignore here.
          void _err;
        }
      } else {
        _log('info', 'ENGINE', `Pull skipped — queueDrained=${queueDrained}, pullDue=${pullDue} (lastPull=${_singleton.lastPullAt ? new Date(_singleton.lastPullAt).toISOString() : 'never'}).`);
      }

      _log('info', 'ENGINE', `Tick done. remaining=${remaining}, pulled=${pulled}.`);
      if (remaining > 0 || pulled) {
        dispatchDataRefreshed();
      }
    } catch (err) {
      _log('warn', 'ENGINE', `Sync engine tick error: ${err?.message || String(err)}`);
    }
  };

  _singleton.intervalId = setInterval(tick, intervalMs);
  void tick();
  _log('info', 'ENGINE', `STARTED singleton sync engine (interval=${intervalMs}ms, pid=${_singleton.startedAt}).`);
  return true;
}

export function stopSyncEngine() {
  if (_singleton.intervalId !== null) {
    clearInterval(_singleton.intervalId);
    _log('info', 'ENGINE', `STOPPED singleton sync engine (pid=${_singleton.startedAt}).`);
  }
  if (_singleton.debounceTimer !== null) {
    clearTimeout(_singleton.debounceTimer);
    _singleton.debounceTimer = null;
  }
  _singleton.intervalId = null;
  _singleton.startedAt = 0;
  _singleton.running = false;
  _singleton.lastRunAt = 0;
}

export function isSyncEngineRunning() {
  return _singleton.running && _singleton.intervalId !== null;
}

export function debouncedProcessQueueFromQueueChanged(delayMs = 750) {
  if (!isAuthenticated()) return;
  if (_singleton.debounceTimer !== null) {
    clearTimeout(_singleton.debounceTimer);
  }
  _singleton.debounceTimer = setTimeout(async () => {
    _singleton.debounceTimer = null;
    if (isSyncLocked()) return;
    try {
      await processQueue();
    } catch { void 0; }
  }, delayMs);
}

/* =============================================================
 * SECTION 10: Sync Decision helper (kept, AuthContext uses via import)
 * ============================================================= */
export async function getSyncDecision(cloudPullSnapshot = null) {
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
    'info',
    'SYNC-DECISION',
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
