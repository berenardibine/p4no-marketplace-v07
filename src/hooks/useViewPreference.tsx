import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useGeo } from '@/context/GeoContext';

const SESSION_KEY = 'smartmarket_session_id';
const PREF_KEY = 'smartmarket_view_pref';

const getSessionId = (): string => {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
};

export type ViewPreference = 'global' | 'country_only';

export const useViewPreference = () => {
  const { user, profile } = useAuth();
  const { country, ip } = useGeo();
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

  // Ensure visitor_preferences session exists in DB (fire-and-forget)
  useEffect(() => {
    if (!country) return;

    const sessionId = getSessionId();
    const maskedIp = ip ? ip.substring(0, 6) + '***' : null;

    // Use raw rpc-style call to avoid type issues with new table
    const ensureSession = async () => {
      try {
        // Check if exists
        const { data } = await (supabase as any)
          .from('visitor_preferences')
          .select('id, filter_preference')
          .eq('session_id', sessionId)
          .maybeSingle();

        if (!data) {
          await (supabase as any).from('visitor_preferences').insert({
            session_id: sessionId,
            ip_address: maskedIp,
            detected_country: country,
            filter_preference: preference,
          });
        } else if (!localStorage.getItem(PREF_KEY) && data.filter_preference) {
          // Returning visitor — restore preference from DB
          setPreference(data.filter_preference);
          localStorage.setItem(PREF_KEY, data.filter_preference);
        }
      } catch {
        // Non-critical
      }
    };

    ensureSession();
  }, [country, ip]);

  const updatePreference = useCallback(async (newPref: ViewPreference) => {
    setPreference(newPref);
    localStorage.setItem(PREF_KEY, newPref);

    const sessionId = getSessionId();

    // Update visitor_preferences in DB
    try {
      await (supabase as any)
        .from('visitor_preferences')
        .update({ filter_preference: newPref })
        .eq('session_id', sessionId);
    } catch {
      // Non-critical
    }

    // If logged in, update profile
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
