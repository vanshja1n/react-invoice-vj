const SETTINGS_KEY = 'invoicehub_settings';

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
  if (!_isAuthed()) return;
  try {
    const { queueOperation } = await import('@/services/sync');
    queueOperation('settings', 'update', data);
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
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    _queueSettings(merged).catch(() => {});
    return merged;
  } catch (e) {
    console.error('Failed to save settings:', e);
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
