import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TwoFactorState {
  enabled: boolean;
  verified: boolean;
  loading: boolean;
  sessionExpired: boolean;
}

/**
 * Hook to check 2FA status for the current user.
 * - `enabled`: user has 2FA turned on
 * - `verified`: user has verified 2FA code in this session (within 3 days)
 * - `sessionExpired`: session has expired (3-day limit)
 */
export const useTwoFactor = (userId: string | undefined) => {
  const [state, setState] = useState<TwoFactorState>({
    enabled: false,
    verified: false,
    loading: true,
    sessionExpired: false,
  });

  const checkStatus = useCallback(async () => {
    if (!userId) {
      setState({ enabled: false, verified: false, loading: false, sessionExpired: false });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_security')
        .select('two_factor_enabled, last_2fa_verified_at, session_expires_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) {
        setState({ enabled: false, verified: false, loading: false, sessionExpired: false });
        return;
      }

      const enabled = data.two_factor_enabled === true;
      const now = new Date();
      
      let verified = false;
      let sessionExpired = false;

      if (enabled && data.session_expires_at) {
        const expiresAt = new Date(data.session_expires_at);
        if (now > expiresAt) {
          sessionExpired = true;
          verified = false;
        } else {
          verified = true;
        }
      } else if (enabled && data.last_2fa_verified_at) {
        // Fallback: check if verified within last 3 days
        const lastVerified = new Date(data.last_2fa_verified_at);
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        verified = lastVerified > threeDaysAgo;
        sessionExpired = !verified;
      }

      setState({ enabled, verified, loading: false, sessionExpired });
    } catch {
      setState({ enabled: false, verified: false, loading: false, sessionExpired: false });
    }
  }, [userId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return { ...state, refresh: checkStatus };
};
