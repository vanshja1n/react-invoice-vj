const DEFAULT_API_BASE = 'http://localhost:5000';
const PRODUCTION_API_BASE = 'https://react-invoice-vj.onrender.com';

const ENV_API_URL = import.meta.env.VITE_API_URL;

const normalizeOrigin = (url) => {
  if (!url) return '';
  const trimmed = String(url).trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/api')) {
    return trimmed.slice(0, -4).replace(/\/+$/, '');
  }
  return trimmed;
};

const DEV_ORIGINS = new Set([
  'http://localhost:5000',
  'http://127.0.0.1:5000',
]);

const rawOrigin = ENV_API_URL ? normalizeOrigin(ENV_API_URL) : '';
const isDevEnv = !rawOrigin || DEV_ORIGINS.has(rawOrigin);
const API_ORIGIN = rawOrigin || (isDevEnv ? DEFAULT_API_BASE : PRODUCTION_API_BASE);

const API_BASE = `${API_ORIGIN}/api`;

function getToken() {
  return localStorage.getItem('invoicehub_token');
}

const LOG_CREATE_DEBUG = true;
function _logCreate(tag, payload) {
  if (!LOG_CREATE_DEBUG) return;
  try { console.info('[CREATE-DUPE-DEBUG]', tag, payload); } catch { void 0; }
}

function _genRequestId(prefix = 'req') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function _isCreatePath(path) {
  if (!path) return false;
  const p = String(path).split('?')[0];
  if (/^https?:\/\//i.test(p)) {
    try {
      const u = new URL(p);
      return _isCreatePath(u.pathname.replace(/^\/api/, '') || u.pathname);
    } catch { /* fallthrough */ }
  }
  const norm = p.replace(/\/+$/, '');
  if (norm.endsWith('/batch')) return true;
  const leaf = norm.split('/').filter(Boolean).pop() || '';
  return leaf !== '' && !/^[0-9a-fA-F]{24}$/.test(leaf);
}

async function request(path, { method = 'GET', body, headers = {}, requiresAuth = true } = {}) {
  const isCreate = method === 'POST' && _isCreatePath(path);
  const requestId = headers['X-Request-Id'] || _genRequestId('api');
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'X-Request-Id': requestId,
    ...headers,
  };

  if (requiresAuth) {
    const token = getToken();
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const options = {
    method,
    headers: defaultHeaders,
  };

  if (body !== undefined) {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const endpoint = /^https?:\/\//i.test(path) ? path : `${API_BASE}${path}`;
  const tsStart = new Date().toISOString();
  if (isCreate) {
    _logCreate('http:create:start', { timestamp: tsStart, endpoint, method, requestId, path });
  }

  try {
    const response = await fetch(endpoint, options);

    if (response.status === 401) {
      localStorage.removeItem('invoicehub_token');
      localStorage.removeItem('invoicehub_user');
      window.dispatchEvent(new CustomEvent('auth-logged-out'));
    }

    let data = null;
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
    }

    if (!response.ok) {
      const errorMessage = data?.error || `HTTP ${response.status}`;
      const error = new Error(errorMessage);
      error.status = response.status;
      if (isCreate) {
        _logCreate('http:create:error', { timestamp: new Date().toISOString(), endpoint, requestId, status: response.status, error: errorMessage });
      }
      throw error;
    }

    if (isCreate) {
      const entityId = data?._id || data?.id || (Array.isArray(data) ? null : null);
      _logCreate('http:create:done', { timestamp: new Date().toISOString(), endpoint, requestId, status: response.status, entityId: String(entityId ?? ''), responseCreated: data?.created ?? undefined });
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
      const offlineError = new Error('OFFLINE');
      offlineError.status = 0;
      if (isCreate) {
        _logCreate('http:create:offline', { timestamp: new Date().toISOString(), endpoint, requestId });
      }
      throw offlineError;
    }
    throw err;
  }
}

export const api = {
  health: {
    check: () => request('/health', { method: 'GET' }),
  },
  auth: {
    signup: (data) => request('/auth/signup', { method: 'POST', body: data, requiresAuth: false }),
    login: (data) => request('/auth/login', { method: 'POST', body: data, requiresAuth: false }),
    google: (data) => request('/auth/google', { method: 'POST', body: data, requiresAuth: false }),
    me: () => request('/auth/me'),
    logout: () => request('/auth/logout', { method: 'POST' }),
  },
  invoices: {
    getAll: () => request('/invoices'),
    get: (id) => request(`/invoices/${id}`),
    create: (data) => request('/invoices', { method: 'POST', body: data }),
    createBatch: (data) => request('/invoices/batch', { method: 'POST', body: data }),
    update: (id, data) => request(`/invoices/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/invoices/${id}`, { method: 'DELETE' }),
    clear: () => request('/invoices', { method: 'DELETE' }),
  },
  products: {
    getAll: () => request('/products'),
    get: (id) => request(`/products/${id}`),
    create: (data) => request('/products', { method: 'POST', body: data }),
    createBatch: (data) => request('/products/batch', { method: 'POST', body: data }),
    update: (id, data) => request(`/products/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/products/${id}`, { method: 'DELETE' }),
    clear: () => request('/products', { method: 'DELETE' }),
  },
  customers: {
    getAll: () => request('/customers'),
    get: (id) => request(`/customers/${id}`),
    create: (data) => request('/customers', { method: 'POST', body: data }),
    createBatch: (data) => request('/customers/batch', { method: 'POST', body: data }),
    update: (id, data) => request(`/customers/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/customers/${id}`, { method: 'DELETE' }),
    clear: () => request('/customers', { method: 'DELETE' }),
  },
  inventory: {
    getAll: () => request('/inventory-history'),
    create: (data) => request('/inventory-history', { method: 'POST', body: data }),
    createBatch: (data) => request('/inventory-history/batch', { method: 'POST', body: data }),
    clear: () => request('/inventory-history', { method: 'DELETE' }),
  },
  settings: {
    get: () => request('/settings'),
    update: (data) => request('/settings', { method: 'PUT', body: data }),
  },
  subscriptions: {
    get: () => request('/subscriptions'),
  },
  sync: {
    pull: () => request('/sync'),
    push: (data) => request('/sync/push', { method: 'POST', body: data }),
  },
};

export { API_ORIGIN, API_BASE };
export default api;
