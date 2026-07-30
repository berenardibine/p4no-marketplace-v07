import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  FEATURE_REGISTRY,
  type FeatureKey,
  getFeatureState,
  isFeatureEnabled,
  loadFeatureFlags,
  setFeatureEnabled,
  subscribeFeatureFlags,
} from '@/lib/featureFlags';

let snapshot = JSON.stringify(getFeatureState());
subscribeFeatureFlags(() => { snapshot = JSON.stringify(getFeatureState()); });

const subscribe = (cb: () => void) => subscribeFeatureFlags(cb);
const getSnapshot = () => snapshot;

/** Reactive single-feature guard. Answers synchronously on first render. */
export function useFeature(key: FeatureKey | string): boolean {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return isFeatureEnabled(key);
}

/** Full flag map + admin mutation, used by the admin toggle screen. */
export function useFeatureFlags() {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadFeatureFlags(true).finally(() => setLoading(false));
  }, []);

  const toggle = async (key: string, enabled: boolean) => {
    setSaving(key);
    try { await setFeatureEnabled(key, enabled); }
    finally { setSaving(null); }
  };

  return {
    features: FEATURE_REGISTRY,
    flags: getFeatureState(),
    loading,
    saving,
    toggle,
    refresh: () => loadFeatureFlags(true),
  };
}
