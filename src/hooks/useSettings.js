import { useState, useEffect, useCallback } from 'react';
import { getSettings, saveSettings } from '@/services/settings';

export function useSettings() {
  const [settings, setSettingsState] = useState(() => getSettings());

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'invoicehub_settings') {
        setSettingsState(getSettings());
      }
    };
    const refresh = () => setSettingsState(getSettings());
    window.addEventListener('storage', handler);
    window.addEventListener('data-refreshed', refresh);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('data-refreshed', refresh);
    };
  }, []);

  const updateSettings = useCallback((newSettings) => {
    const merged = saveSettings({ ...settings, ...newSettings });
    setSettingsState(merged);
    return merged;
  }, [settings]);

  const updateSetting = useCallback((key, value) => {
    const updated = { ...settings, [key]: value };
    const merged = saveSettings(updated);
    setSettingsState(merged);
    return merged;
  }, [settings]);

  return { settings, updateSettings, updateSetting };
}
