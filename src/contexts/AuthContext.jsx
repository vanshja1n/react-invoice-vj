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
  invalidateMetadataCache,
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
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const evaluateRef = useRef(null);
  const backgroundSyncActiveRef = useRef(false);

  const dispatchDialogNeeded = useCallback((payload) => {
    try {
      window.dispatchEvent(new CustomEvent(TRIGGER_SYNC_DIALOG_EVENT, { detail: payload || {} }));
    } catch { void 0; }
  }, []);

  const setBackgroundSyncingSafe = useCallback((val) => {
    backgroundSyncActiveRef.current = val;
    setBackgroundSyncing(val);
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
      const { action, mergeRequired } = decision;

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
            setBackgroundSyncingSafe(true);
            await pullFromCloud({ force: true });
          } catch (err) {
            setSyncStrategy(null);
            console.error('[Auth] load-cloud failed — leaving guest workspace intact. Will retry next tick.', err);
            evaluateRef.current = null;
          } finally {
            setBackgroundSyncingSafe(false);
          }
          setSyncChoiceLock(false);
          dispatchDataRefreshed();
          break;
        }
        case 'upload-guest': {
          setSyncStrategy('replace-cloud');
          try {
            setBackgroundSyncingSafe(true);
            await pushLocalToCloud();
          } catch (err) {
            setSyncStrategy(null);
            console.error('[Auth] upload-guest failed — leaving guest workspace intact. Will retry next tick.', err);
            evaluateRef.current = null;
          } finally {
            setBackgroundSyncingSafe(false);
          }
          setSyncChoiceLock(false);
          dispatchDataRefreshed();
          break;
        }
        case 'merge':
        default: {
          if (mergeRequired === false) {
            setSyncStrategy('cloud');
            setSyncChoiceLock(false);
            dispatchDataRefreshed();
            break;
          }
          setSyncChoiceLock(true);
          dispatchDialogNeeded({});
          break;
        }
      }
    } catch (err) {
      console.warn('[Auth] evaluateSyncDecision failed — will retry on next auth/online/interval event.', err);
      evaluateRef.current = null;
    }
  }, [token, dispatchDialogNeeded, setBackgroundSyncingSafe]);

  const restoreCloudIfEmpty = useCallback(async () => {
    if (!token) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (isSyncChoiceLocked()) return;
    if (await isSyncChoiceUnresolved()) return;
    try {
      const hasData = await hasLocalData();
      
      if (!hasData) {
        setBackgroundSyncingSafe(true);
        try {
          await pullFromCloud({ force: true });
          dispatchDataRefreshed();
        } finally {
          setBackgroundSyncingSafe(false);
        }
      } else {
        try {
          const { getSettings: _getS, DEFAULT_SETTINGS: _ds } = await import('@/services/settings');
          const localSettings = _getS();
          const localSettingsEdited = localSettings !== _ds;
          
          if (localSettingsEdited) {
            const { queueOperation } = await import('@/services/sync');
            queueOperation('settings', 'update', localSettings);
          }
          
          const { processQueue } = await import('@/services/sync');
          await processQueue();
        } catch (err) {
          console.warn('[Auth] Background settings sync failed:', err);
        }
      }
    } catch {
      void 0;
    }
  }, [token, setBackgroundSyncingSafe]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const me = await api.auth.me();
      localStorage.setItem(USER_KEY, JSON.stringify(me));
      setUser(me);
    } catch (_e) { void _e; }
  }, [token]);

  useEffect(() => {
    if (!token) {
      stopSyncEngine();
      return;
    }

    // PARALLEL STARTUP: refreshUser and queue length are independent — no dependency.
    // refreshUser runs silently in the background; it does not block UI.
    refreshUser().catch(() => {});
    setPendingCount(getQueue().length);

    const strat = getSyncStrategy();

    if (strat) {
      // Existing session — strategy already known. Sync decision already resolved.
      // Kick off restoreCloudIfEmpty and queue-drain entirely in the background,
      // do NOT await them before the app is usable.
      (async () => {
        try {
          setBackgroundSyncingSafe(true);
          // PARALLELIZE: restoreCloudIfEmpty (hasLocalData + pullFromCloud) and
          // processQueue are independent operations once strategy is set.
          // However: processQueue must drain non-clear ops BEFORE pullFromCloud
          // to avoid wiping uncommitted local writes. They must be sequential
          // inside restoreCloudIfEmpty which handles this correctly.
          await restoreCloudIfEmpty();
          if (!isSyncChoiceLocked() && !(await isSyncChoiceUnresolved())) {
            const pending = await processQueue().catch(() => getQueue().length);
            setPendingCount(pending);
          }
        } finally {
          setBackgroundSyncingSafe(false);
        }
      })();
      // Skip evaluateSyncDecision entirely — strategy already set from prior session.
      return;
    }

    // No strategy set: this is a new sign-in. Show UI immediately, then
    // evaluate sync decision + initial sync in the background.
    setSyncChoiceLock(true);
    (async () => {
      try {
        setBackgroundSyncingSafe(true);
        await evaluateSyncDecision();
      } finally {
        setBackgroundSyncingSafe(false);
      }
    })();
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
            (async () => {
              try {
                setBackgroundSyncingSafe(true);
                await evaluateSyncDecision();
              } finally {
                setBackgroundSyncingSafe(false);
              }
            })();
          }
          setPendingCount(getQueue().length);
          return;
        }
        const count = await processQueue();
        if (typeof count === 'number') setPendingCount(count);
        (async () => {
          try {
            setBackgroundSyncingSafe(true);
            await restoreCloudIfEmpty();
          } finally {
            setBackgroundSyncingSafe(false);
          }
        })();
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
  }, [token, restoreCloudIfEmpty, evaluateSyncDecision, setBackgroundSyncingSafe]);

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
    evaluateRef.current = null;
    invalidateMetadataCache();
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    evaluateRef.current = null;
    invalidateMetadataCache();
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
      // NOTE: prepareBeforeAuth() does IndexedDB reads — they're quick but we
      // still run them before the API call because we need the result for the
      // sync dialog logic. If they become slow we can parallelize with the API.
      await prepareBeforeAuth();
      const result = await api.auth.signup({ email, password, name });
      // UI flips to authenticated immediately via persistAuth — we don't wait
      // for sync or any cloud operation.
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
    // INSTANT UX: Show "Signing out..." overlay right away.
    setSigningOut(true);

    // Stop the sync engine FIRST so no background ticks fire during wipe.
    try { stopSyncEngine(); } catch { void 0; }

    // Clear frontend auth state IMMEDIATELY — UI flips to signed-out view
    // without waiting for the API or workspace wipe.
    clearAuth();

    // Remaining work (API call, workspace wipe) is run WITHOUT blocking the UI.
    // We keep `signingOut` briefly but don't hold the UI beyond a timeout.
    const LOGOUT_UI_TIMEOUT_MS = 500;

    const finalizeUi = () => {
      setLoading(false);
      setSigningOut(false);
      setBackgroundSyncingSafe(false);
      dispatchDataRefreshed(50);
    };

    // UI timeout: after 500ms, unblock the overlay even if backend work lingers.
    const uiTimeoutHandle = setTimeout(finalizeUi, LOGOUT_UI_TIMEOUT_MS);

    (async () => {
      try {
        // Best-effort server-side logout. No timeout because we've already
        // unblocked the UI via LOGOUT_UI_TIMEOUT_MS.
        if (token) {
          try { await api.auth.logout(); } catch { void 0; }
        }
        // Clear workspace (IndexedDB tables, localStorage keys, sync state).
        // This internally runs settings flush with 3s timeout + parallel clears.
        await clearWorkspaceForLogout();
      } finally {
        clearTimeout(uiTimeoutHandle);
        finalizeUi();
      }
    })();
  }, [token, clearAuth, setBackgroundSyncingSafe]);

  const handleSyncChoice = useCallback(async (choice) => {
    setSyncing(true);
    setBackgroundSyncingSafe(true);
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
      setBackgroundSyncingSafe(false);
    }
  }, [setBackgroundSyncingSafe]);

  useEffect(() => {
    if (!token) return;
    if (loading) return;
    if (syncing) return;
    if (backgroundSyncActiveRef.current) return;
    const strat = getSyncStrategy();
    if (!strat) {
      (async () => {
        const hdata = await hasLocalData();
        if (!hdata && typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            setBackgroundSyncingSafe(true);
            await evaluateSyncDecision();
          } finally {
            setBackgroundSyncingSafe(false);
          }
        } else if (hdata) {
          try {
            setBackgroundSyncingSafe(true);
            await evaluateSyncDecision();
          } finally {
            setBackgroundSyncingSafe(false);
          }
        } else {
          void 0;
        }
      })();
    }
  }, [token, loading, syncing, evaluateSyncDecision, setBackgroundSyncingSafe]);

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated: !!token,
    loading,
    syncing,
    isOnline,
    pendingCount,
    backgroundSyncing,
    signingOut,
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
    user, token, loading, syncing, isOnline, pendingCount, backgroundSyncing, signingOut,
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
