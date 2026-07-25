import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

/**
 * Captures ?ref=CODE from URL on any page load.
 * Stores it in localStorage so it persists across sessions.
 * Validates the code and stores referrer name.
 */
const ReferralCapture = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (!refCode) return;

    // Already have this code stored? Skip.
    const existing = localStorage.getItem('p4no-referral-code');
    if (existing === refCode) {
      // Clean URL
      searchParams.delete('ref');
      setSearchParams(searchParams, { replace: true });
      return;
    }

    const validateAndStore = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, referral_code')
          .eq('referral_code', refCode)
          .maybeSingle();

        if (data) {
          localStorage.setItem('p4no-referral-code', refCode);
          localStorage.setItem('p4no-referrer-name', data.full_name || '');
          // Also set in session storage for backward compat
          sessionStorage.setItem('sm-referral-code', refCode);
          sessionStorage.setItem('sm-referrer-name', data.full_name || '');
        }
      } catch (err) {
        console.error('[p4no] Referral validation error:', err);
      }

      // Clean the URL regardless
      searchParams.delete('ref');
      setSearchParams(searchParams, { replace: true });
    };

    validateAndStore();
  }, [searchParams]);

  return null;
};

export default ReferralCapture;
