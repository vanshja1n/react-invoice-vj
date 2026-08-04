const SETTINGS_KEY = 'invoicehub_settings';
const SETTINGS_TAG = '[SETTINGS]';


function _logSettings(subTag, ...args) {
  try {
    console.info(`${SETTINGS_TAG} ${new Date().toISOString()} [${subTag}]`, ...args);
  } catch { void 0; }
}

function _settingsSummary(s) {
  if (!s) return null;
  return {
    companyName: s.companyName,
    companyEmail: s.companyEmail,
    companyPhone: s.companyPhone,
    companyAddress: s.companyAddress,
    gstNumber: s.gstNumber,
    defaultTax: s.defaultTax,
    defaultCurrency: s.defaultCurrency,
    defaultNotes: s.defaultNotes ? s.defaultNotes.slice(0, 40) : s.defaultNotes,
    defaultTerms: s.defaultTerms ? s.defaultTerms.slice(0, 40) : s.defaultTerms,
    defaultInvoiceTemplate: s.defaultInvoiceTemplate,
    theme: s.theme,
    companyLogo: s.companyLogo
      ? `[base64 ${s.companyLogo.length} chars]`
      : s.companyLogo,
  };
}



const DEFAULT_SETTINGS = {
  companyName: '',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  companyLogo: null,
  gstNumber: '',
  defaultTax: 0,
  defaultCurrency: '₹',
  defaultNotes: 'Thank you for your business!',
  defaultTerms: 'Payment is due within 30 days of the invoice date.',
  defaultInvoiceTemplate: 'corporate',
  theme: 'system', // 'light' | 'dark' | 'system'
};

function _isAuthed() {
  return !!localStorage.getItem('invoicehub_token');
}

async function _queueSettings(data) {
  if (!_isAuthed()) {
    _logSettings('QUEUE-SKIP', '_queueSettings skipped — not authenticated.');
    return;
  }
  try {
    const { queueOperation } = await import('@/services/sync');
    queueOperation('settings', 'update', data);
    _logSettings('QUEUE-ADD', 'settings:update enqueued.', _settingsSummary(data));
  } catch (_err) { void _err; /* noop */ }
}

export function getSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings) {
  try {
    const before = (() => { try { const r = localStorage.getItem(SETTINGS_KEY); return r ? JSON.parse(r) : null; } catch { return null; } })();
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    _logSettings('SAVE', 'saveSettings called (will queue). Before:', _settingsSummary(before), '→ After:', _settingsSummary(merged), '| caller:', new Error().stack?.split('\n')[2]?.trim() || 'unknown');
    _queueSettings(merged).catch(() => {});
    return merged;
  } catch (e) {
    console.error('Failed to save settings:', e);
    return settings;
  }
}

/**
 * Write settings to localStorage WITHOUT adding a sync queue entry.
 * Use this when restoring settings from the cloud (pullFromCloud, mergeLocalAndCloud)
 * so we don't re-queue data that was just downloaded — which would create a feedback
 * loop and risk overwriting the cloud with stale/default-merged values.
 */
export function saveSettingsSilent(settings) {
  try {
    const before = (() => { try { const r = localStorage.getItem(SETTINGS_KEY); return r ? JSON.parse(r) : null; } catch { return null; } })();
    
    // CRITICAL FIX: Merge with existing settings, never overwrite valid values with empty/undefined/null
    // This prevents cloud sync from overwriting valid local settings with empty values
    const merged = { ...DEFAULT_SETTINGS };
    
    // First merge existing local settings (which are authoritative if they have values)
    if (before) {
      for (const key of Object.keys(before)) {
        const localVal = before[key];
        // Preserve local value if it's not null/undefined/empty string
        if (localVal !== null && localVal !== undefined && localVal !== '') {
          merged[key] = localVal;
        }
      }
    }
    
    // Then merge cloud settings, but only if they have valid values
    if (settings) {
      for (const key of Object.keys(settings)) {
        const cloudVal = settings[key];
        // Only use cloud value if it's valid (not null/undefined/empty string)
        if (cloudVal !== null && cloudVal !== undefined && cloudVal !== '') {
          merged[key] = cloudVal;
        }
      }
    }
    
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    _logSettings('SAVE-SILENT', 'saveSettingsSilent called (no queue). Before:', _settingsSummary(before), '→ After:', _settingsSummary(merged), '| caller:', new Error().stack?.split('\n')[2]?.trim() || 'unknown');
    return merged;
  } catch (e) {
    console.error('Failed to save settings (silent):', e);
    return settings;
  }
}

export function getSetting(key) {
  const settings = getSettings();
  return settings[key] ?? DEFAULT_SETTINGS[key];
}

export function setSetting(key, value) {
  const settings = getSettings();
  settings[key] = value;
  saveSettings(settings);
  return value;
}

export { DEFAULT_SETTINGS };
