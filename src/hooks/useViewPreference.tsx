import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const PREF_KEY = 'smartmarket_view_pref';

export type ViewPreference = 'global' | 'country_only';

export const useViewPreference = () => {
  const { user, profile } = useAuth();
  const [preference, setPreference] = useState<ViewPreference>(() => {
    // Synchronous init from localStorage for instant render
    const cached = localStorage.getItem(PREF_KEY);
    return (cached === 'country_only') ? 'country_only' : 'global';
  });
  const [loaded, setLoaded] = useState(false);

  // Sync with profile preference when logged in
  useEffect(() => {
    if (user && profile) {
      const profilePref = (profile as any).preferred_view as string | null;
      if (profilePref === 'country_only' || profilePref === 'global') {
        setPreference(profilePref);
        localStorage.setItem(PREF_KEY, profilePref);
      }
    }
    setLoaded(true);
  }, [user, profile]);

  // NOTE: public visits no longer create or read a `visitor_preferences` row.
  // The preference lives in localStorage for anonymous visitors and on the
  // profile for signed-in users, so a public visit performs zero DB writes.

  const updatePreference = useCallback(async (newPref: ViewPreference) => {
    setPreference(newPref);
    localStorage.setItem(PREF_KEY, newPref);

    // Only signed-in users persist the choice (on their own profile row).
    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ preferred_view: newPref } as any)
          .eq('id', user.id);
      } catch {
        // Non-critical
      }
    }
  }, [user]);

  return {
    preference,
    loaded,
    updatePreference,
    isCountryOnly: preference === 'country_only',
    isGlobal: preference === 'global',
  };
};
