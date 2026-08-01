import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import api from '@/services/api';
import {
  pullFromCloud,
  pushLocalToCloud,
  mergeLocalAndCloud,
  clearUserDataFromIndexedDB,
  clearWorkspaceForLogout,
  hasLocalData,
  setSyncStrategy,
  getSyncStrategy,
  queueOperation,
  processQueue,
  getQueue,
  setSyncChoiceLock,
  isSyncChoiceLocked,
  isSyncChoiceUnresolved,
  dispatchDataRefreshed,
  getSyncDecision,
  startSyncEngine,
  stopSyncEngine,
  isSyncEngineRunning,
  debouncedProcessQueueFromQueueChanged,
} from '@/services/sync';

const AuthContext = createContext(null);

function _logAuth(tag, ...args) {
  try {
    const ts = new Date().toISOString();
    console.info(`[InvoiceHub Auth] ${ts} [${tag}]`, ...args);
  } catch { void 0; }
}

const TOKEN_KEY = 'invoicehub_token';
const USER_KEY = 'invoicehub_user';
const TRIGGER_SYNC_DIALOG_EVENT = 'trigger-sync-dialog';
const SYNC_DECISION_PENDING_KEY = 'invoicehub_sync_decision_pending_ms';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const evaluateRef = useRef(null);  // {token, ts} to prevent double-evaluate same auth session

  const dispatchDialogNeeded = useCallback((payload) => {
    try {
      window.dispatchEvent(new CustomEvent(TRIGGER_SYNC_DIALOG_EVENT, { detail: payload || {} }));
    } catch { void 0; }
  }, []);

  const evaluateSyncDecision = useCallback(async () => {
    if (!token) return;
    const strat = getSyncStrategy();
    if (strat) return;

    const guardKey = `${token.slice(-8)}:${Math.floor(Date.now() / 5000)}`;
    if (evaluateRef.current && evaluateRef.current.key === guardKey) return;
    evaluateRef.current = { key: guardKey, ts: Date.now() };

    try {
      const decision = await getSyncDecision();
      const { action, localCounts, cloudCounts, mergeRequired } = decision;

      switch (action) {
        case 'empty-workspace': {
          setSyncStrategy('cloud');
          setSyncChoiceLock(false);
          dispatchDataRefreshed();
          break;
        }
        case 'load-cloud': {
          setSyncStrategy('cloud');
          try {
            await pullFromCloud({ force: true });
          } catch (err) {
            setSyncStrategy(null);
            console.error('[Auth] load-cloud failed — leaving guest workspace intact. Will retry next tick.', err);
            evaluateRef.current = null;
            break;
          }
          setSyncChoiceLock(false);
          dispatchDataRefreshed();
          break;
        }
        case 'upload-guest': {
          setSyncStrategy('replace-cloud');
          try {
            await pushLocalToCloud();
          } catch (err) {
            setSyncStrategy(null);
            console.error('[Auth] upload-guest failed — leaving guest workspace intact. Will retry next tick.', err);
            evaluateRef.current = null;
            break;
          }
          setSyncChoiceLock(false);
          dispatchDataRefreshed();
          break;
        }
        case 'merge':
        default: {
          if (mergeRequired === false) {
            // Safety: something odd happened, default to cloud source-of-truth
            setSyncStrategy('cloud');
            setSyncChoiceLock(false);
            dispatchDataRefreshed();
            break;
          }
          setSyncChoiceLock(true);
          // Only case where we actually prompt the user. Pass counts to dialog via event detail.
          dispatchDialogNeeded({ localCounts, cloudCounts });
          break;
        }
      }
    } catch (err) {
      console.warn('[Auth] evaluateSyncDecision failed — will retry on next auth/online/interval event.', err);
      evaluateRef.current = null;
    }
  }, [token, dispatchDialogNeeded]);

  const restoreCloudIfEmpty = useCallback(async () => {
    if (!token) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (isSyncChoiceLocked()) return;
    if (await isSyncChoiceUnresolved()) return;
    try {
      const hasData = await hasLocalData();
      if (hasData) return;
      try {
        await pullFromCloud({ force: true });
        dispatchDataRefreshed();
      } catch (err) {
        if (err && err.message === 'SYNC_LOCKED') return;
      }
    } catch {
      void 0;
    }
  }, [token]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const me = await api.auth.me();
      localStorage.setItem(USER_KEY, JSON.stringify(me));
      setUser(me);
    } catch (_e) { void _e; }
  }, [token]);

  useEffect(() => {
    if (token) {
      refreshUser().finally(async () => {
        if (getSyncStrategy()) {
          await restoreCloudIfEmpty();
          if (!isSyncChoiceLocked() && !(await isSyncChoiceUnresolved())) {
            const pending = await processQueue().catch(() => getQueue().length);
            setPendingCount(pending);
          } else {
            setPendingCount(getQueue().length);
          }
          // If strategy already set from prior session, skip evaluateSyncDecision entirely.
          return;
        }
        // No strategy set: this is a new sign-in. Let evaluateSyncDecision run the full table.
        setSyncChoiceLock(true);
        await evaluateSyncDecision();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      if (!token) return;
      try {
        const locked = isSyncChoiceLocked() || await isSyncChoiceUnresolved();
        if (locked) {
          if (!getSyncStrategy()) {
            await evaluateSyncDecision();
          }
          setPendingCount(getQueue().length);
          return;
        }
        const count = await processQueue();
        if (typeof count === 'number') setPendingCount(count);
        await restoreCloudIfEmpty();
        if (!isSyncEngineRunning()) {
          startSyncEngine(10000);
        }
      } catch { void 0; }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [token, restoreCloudIfEmpty, evaluateSyncDecision]);

  useEffect(() => {
    if (!token) {
      stopSyncEngine();
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setPendingCount(getQueue().length);
      return;
    }
    const started = startSyncEngine(10000);
    if (started) {
      _logAuth('SINGLETON-ENGINE', 'Started singleton sync engine (interval=10s) for new auth session.');
    }
    return () => {
      stopSyncEngine();
    };
  }, [token]);

  useEffect(() => {
    const handler = () => {
      setPendingCount(getQueue().length);
      debouncedProcessQueueFromQueueChanged(750);
    };
    window.addEventListener('queue-changed', handler);
    return () => window.removeEventListener('queue-changed', handler);
  }, []);

  const persistAuth = useCallback((newToken, newUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    // Clear evaluate cache so effect below re-evaluates decision with new token
    evaluateRef.current = null;
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    evaluateRef.current = null;
  }, []);

  const prepareBeforeAuth = useCallback(async () => {
    const hasData = await hasLocalData();
    const strategy = getSyncStrategy();
    if (hasData && !strategy) {
      setSyncChoiceLock(true);
    }
    return hasData;
  }, []);

  const signup = useCallback(async (email, password, name) => {
    setLoading(true);
    try {
      await prepareBeforeAuth();
      const result = await api.auth.signup({ email, password, name });
      persistAuth(result.token, result.user);
      return { user: result.user };
    } finally {
      setLoading(false);
    }
  }, [persistAuth, prepareBeforeAuth]);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      await prepareBeforeAuth();
      const result = await api.auth.login({ email, password });
      persistAuth(result.token, result.user);
      return { user: result.user };
    } finally {
      setLoading(false);
    }
  }, [persistAuth, prepareBeforeAuth]);

  const loginWithGoogle = useCallback(async (tokenId) => {
    setLoading(true);
    try {
      await prepareBeforeAuth();
      const result = await api.auth.google({ tokenId });
      persistAuth(result.token, result.user);
      return { user: result.user };
    } finally {
      setLoading(false);
    }
  }, [persistAuth, prepareBeforeAuth]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      if (token) {
        await api.auth.logout().catch(() => {});
      }
      await clearWorkspaceForLogout();
    } finally {
      clearAuth();
      setLoading(false);
      dispatchDataRefreshed(50);
    }
  }, [token, clearAuth]);

  const handleSyncChoice = useCallback(async (choice) => {
    setSyncing(true);
    try {
      switch (choice) {
        case 'merge':
          setSyncStrategy('merge');
          await mergeLocalAndCloud();
          break;
        case 'local':
          setSyncStrategy('local');
          break;
        case 'replace-cloud':
          setSyncStrategy('replace-cloud');
          await pushLocalToCloud();
          break;
        case 'cloud':
          setSyncStrategy('cloud');
          try {
            await pullFromCloud({ force: true });
            try { await clearUserDataFromIndexedDB(); } catch (_e) { void _e; }
            // Only re-apply settings to Dexie if clearUserDataFromIndexedDB wiped them.
            // No need to do full network pullFromCloud again; data already fresh in IndexedDB.
            dispatchDataRefreshed();
          } catch (err) {
            console.error('[Auth] cloud choice failed during atomic pull — leaving guest workspace intact.');
            throw err;
          }
          break;
        default:
          break;
      }
      setSyncChoiceLock(false);
      dispatchDataRefreshed();
    } catch (err) {
      console.error('[InvoiceHub Auth] handleSyncChoice failed — guest data preserved, user must retry.',
        { choice, error: err?.message || String(err) });
      throw err;
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    if (loading) return;
    if (syncing) return;
    // When authentication settles and strategy is still missing, re-evaluate.
    // This catches: sign-in success, F5 after sign-in (while token persists but strategy wasn't saved due to network error last round, etc.)
    const strat = getSyncStrategy();
    if (!strat) {
      (async () => {
        const hdata = await hasLocalData();
        if (!hdata && typeof navigator !== 'undefined' && navigator.onLine) {
          // Probably a returning sign-in with empty guest workspace. Short-circuit evaluate now.
          await evaluateSyncDecision();
        } else if (hdata) {
          // Has unmerged guest data — re-evaluate so if user closed dialog without choosing we can still open if needed.
          await evaluateSyncDecision();
        } else {
          void 0;
        }
      })();
    }
  }, [token, loading, syncing, evaluateSyncDecision]);

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated: !!token,
    loading,
    syncing,
    isOnline,
    pendingCount,
    signup,
    login,
    loginWithGoogle,
    logout,
    refreshUser,
    handleSyncChoice,
    syncStrategy: getSyncStrategy(),
    queueOperation,
    dismissSyncChoice: () => {
      setSyncChoiceLock(false);
    },
  }), [
    user, token, loading, syncing, isOnline, pendingCount,
    signup, login, loginWithGoogle, logout, refreshUser, handleSyncChoice,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { TRIGGER_SYNC_DIALOG_EVENT, SYNC_DECISION_PENDING_KEY };
export default AuthContext;
