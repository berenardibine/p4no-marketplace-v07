import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const EXEMPT_ROUTES = [
  '/auth',
  '/auth/callback',
  '/onboarding',
  '/complete-profile',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/blocked',
];

const SELLER_PROTECTED = ['/seller-dashboard', '/my-shop', '/seller-monetization'];

/**
 * Strict profile completion enforcement.
 *  - Authenticated user with no role -> /onboarding/account-type
 *  - Seller missing full_name | call_number | whatsapp_number -> /complete-profile/phone
 *  - Buyer missing full_name | call_number -> /complete-profile/phone
 *  - Seller-only routes additionally require both numbers
 */
const ProfileCompletionGuard = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [roles, setRoles] = useState<string[] | null>(null);

  useEffect(() => {
    if (!user) { setRoles(null); return; }
    supabase.from('user_roles').select('role').eq('user_id', user.id).then(({ data }) => {
      setRoles(data?.map((r: any) => r.role) || []);
    });
  }, [user]);

  useEffect(() => {
    if (loading || !user || roles === null) return;
    const isExempt = EXEMPT_ROUTES.some(r => location.pathname.startsWith(r));
    if (isExempt) return;

    if (roles.length === 0 || (!roles.includes('buyer') && !roles.includes('seller'))) {
      navigate('/onboarding/account-type', { replace: true });
      return;
    }

    if (!profile) return;

    const hasName = !!profile.full_name?.trim();
    const hasCall = !!profile.call_number?.trim();
    const hasWhatsapp = !!profile.whatsapp_number?.trim();

    const isSeller = roles.includes('seller');
    const isBuyer = roles.includes('buyer');

    // Seller: name + call + whatsapp required
    if (isSeller && (!hasName || !hasCall || !hasWhatsapp)) {
      navigate('/complete-profile/phone', { replace: true });
      return;
    }

    // Buyer-only: name + at least 1 phone required
    if (!isSeller && isBuyer && (!hasName || !hasCall)) {
      navigate('/complete-profile/phone', { replace: true });
      return;
    }

    // Extra guard for seller-protected zones
    if (isSeller) {
      const onSellerProtected = SELLER_PROTECTED.some(r => location.pathname.startsWith(r));
      if (onSellerProtected && (!hasName || !hasCall || !hasWhatsapp)) {
        navigate('/complete-profile/phone', { replace: true });
      }
    }
  }, [user, profile, roles, loading, location.pathname, navigate]);

  return null;
};

export default ProfileCompletionGuard;
