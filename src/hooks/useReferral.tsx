import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cachedQuery } from '@/lib/queryCache';
import { useAuth } from './useAuth';

interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  pendingReferrals: number;
  invalidReferrals: number;
  totalRewards: number;
}

interface Referral {
  id: string;
  referrer_id: string | null;
  referred_user_id: string | null;
  referral_code: string;
  status: string | null;
  created_at: string | null;
  activated_at: string | null;
  invalid_reason: string | null;
  is_valid: boolean | null;
  referee_products_count: number | null;
  referee_account_age_days: number | null;
  referee?: { full_name: string; profile_image: string | null } | null;
}

export const useReferral = () => {
  const { user, profile } = useAuth();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0, activeReferrals: 0, pendingReferrals: 0,
    invalidReferrals: 0, totalRewards: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && profile) {
      setReferralCode((profile as any).referral_code || null);
      fetchReferrals();
    } else {
      setLoading(false);
    }
  }, [user, profile]);

  const fetchReferrals = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [refsRes, rewardsRes] = await Promise.all([
        supabase.from('referrals').select('*, referee:profiles!referrals_referred_user_id_fkey(full_name, profile_image)').eq('referrer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('referral_rewards').select('amount').eq('user_id', user.id).eq('status', 'credited'),
      ]);

      const refs = (refsRes.data || []) as Referral[];
      const totalRewards = (rewardsRes.data || []).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
      setReferrals(refs);

      setStats({
        totalReferrals: refs.length,
        activeReferrals: refs.filter(r => r.status === 'active').length,
        pendingReferrals: refs.filter(r => r.status === 'pending').length,
        invalidReferrals: refs.filter(r => r.status === 'invalid').length,
        totalRewards,
      });
    } catch (err) {
      console.error('Error fetching referrals:', err);
    } finally {
      setLoading(false);
    }
  };

  const getShareUrl = useCallback(() => {
    if (!referralCode) return '';
    return `${window.location.origin}/r/${referralCode}`;
  }, [referralCode]);

  const trackShare = async (channel: string) => {
    if (!user || !referralCode) return;
    try {
      await supabase.from('referral_shares').insert({
        user_id: user.id,
        referral_code: referralCode,
        channel,
        share_url: getShareUrl(),
      });
    } catch (err) {
      console.error('Error tracking share:', err);
    }
  };

  const validateCode = async (code: string): Promise<{ valid: boolean; referrerName?: string; error?: string }> => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, referral_code')
        .eq('referral_code', code)
        .maybeSingle();

      if (profileData) {
        if (user && profileData.id === user.id) {
          return { valid: false, error: 'You cannot use your own referral code' };
        }
        return { valid: true, referrerName: profileData.full_name };
      }
      return { valid: false, error: 'Invalid referral code' };
    } catch {
      return { valid: false, error: 'Error validating code' };
    }
  };

  const applyReferralCode = async (code: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not logged in' };
    if ((profile as any)?.referred_by) {
      return { success: false, error: 'You already have a referral code applied' };
    }

    const validation = await validateCode(code);
    if (!validation.valid) return { success: false, error: validation.error };

    try {
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('referral_code', code)
        .single();

      if (!referrer) return { success: false, error: 'Referrer not found' };

      const { error: refError } = await supabase.from('referrals').insert({
        referrer_id: referrer.id,
        referred_user_id: user.id,
        referral_code: code,
        status: 'pending',
        is_valid: true,
      });
      if (refError) throw refError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ referred_by: code })
        .eq('id', user.id);
      if (profileError) throw profileError;

      // Notify the referrer that someone used their code
      await supabase.from('notifications').insert({
        user_id: referrer.id,
        title: 'New Referral! 🎉',
        message: `${(profile as any)?.full_name || 'Someone'} used your referral code "${code}". Waiting for activation requirements.`,
        type: 'referral',
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to apply referral code' };
    }
  };

  return {
    referralCode, referrals, stats, loading,
    getShareUrl, trackShare, validateCode, applyReferralCode,
    refetch: fetchReferrals,
  };
};

// Session referral hook - checks both localStorage and sessionStorage
export const useSessionReferral = () => {
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);

  useEffect(() => {
    // Check localStorage first (new ?ref= system), then sessionStorage (old /r/ system)
    const lsCode = localStorage.getItem('p4no-referral-code');
    const lsName = localStorage.getItem('p4no-referrer-name');
    const ssCode = sessionStorage.getItem('sm-referral-code');
    const ssName = sessionStorage.getItem('sm-referrer-name');
    
    const code = lsCode || ssCode;
    const name = lsName || ssName;
    if (code) { setSessionCode(code); setReferrerName(name); }
  }, []);

  const setReferral = (code: string, name?: string) => {
    localStorage.setItem('p4no-referral-code', code);
    sessionStorage.setItem('sm-referral-code', code);
    if (name) {
      localStorage.setItem('p4no-referrer-name', name);
      sessionStorage.setItem('sm-referrer-name', name);
    }
    setSessionCode(code);
    setReferrerName(name || null);
  };

  const clearReferral = () => {
    localStorage.removeItem('p4no-referral-code');
    localStorage.removeItem('p4no-referrer-name');
    sessionStorage.removeItem('sm-referral-code');
    sessionStorage.removeItem('sm-referrer-name');
    setSessionCode(null);
    setReferrerName(null);
  };

  return { sessionCode, referrerName, setReferral, clearReferral };
};

// Featured products hook
export const useFeaturedProducts = (userCountry?: string | null) => {
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchFeatured(); }, [userCountry]);

  const fetchFeatured = async () => {
    setLoading(true);
    try {
      // Global list — one shared fetch per 5 minutes for all visitors.
      const featured = await cachedQuery<any[]>('featured:active:v1', async () => {
        const { data } = await supabase
          .from('featured_products')
          .select('*, product:products!featured_products_product_id_fkey(id, title, price, images, category, currency_symbol, rental_unit, sponsored, is_negotiable, admin_posted, country, slug, location)')
          .eq('is_active', true)
          .gt('end_at', new Date().toISOString())
          .order('start_at', { ascending: false })
          .limit(12);
        return data ?? [];
      }, { ttlMs: 5 * 60_000 });

      if (featured) {
        let products = featured
          .map((f: any) => ({ ...f.product, featured_end: f.end_at, featured_reason: f.reason }))
          .filter((p: any) => p?.id);
        if (userCountry) {
          products = products.filter((p: any) => p.country === userCountry || !p.country);
        }
        setFeaturedProducts(products);
      }
    } catch (err) {
      console.error('Error fetching featured products:', err);
    } finally {
      setLoading(false);
    }
  };

  return { featuredProducts, loading, refetch: fetchFeatured };
};

// Admin referral hook
export const useAdminReferrals = () => {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [invalidReferrals, setInvalidReferrals] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0, active: 0, pending: 0, invalid: 0, featuredCount: 0, pendingRedemptions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [refsRes, invalidRes, featuredRes, redemptionsRes] = await Promise.all([
        supabase.from('referrals').select('*, referrer:profiles!referrals_referrer_id_fkey(full_name, profile_image), referee:profiles!referrals_referred_user_id_fkey(full_name, profile_image)').order('created_at', { ascending: false }).limit(200),
        supabase.from('invalid_referrals').select('*').eq('reviewed', false).order('created_at', { ascending: false }).limit(50),
        supabase.from('featured_products').select('id', { count: 'exact', head: true }).eq('is_active', true).gt('end_at', new Date().toISOString()),
        (supabase as any).from('reward_redemptions').select('*, profile:profiles!reward_redemptions_user_id_fkey(full_name, profile_image), task:reward_tasks(*)').eq('status', 'pending').order('created_at', { ascending: false }),
      ]);

      const refs = refsRes.data || [];
      setReferrals(refs);
      setInvalidReferrals(invalidRes.data || []);
      setRedemptions(redemptionsRes.data || []);

      setStats({
        total: refs.length,
        active: refs.filter((r: any) => r.status === 'active').length,
        pending: refs.filter((r: any) => r.status === 'pending').length,
        invalid: refs.filter((r: any) => r.status === 'invalid').length,
        featuredCount: featuredRes.count || 0,
        pendingRedemptions: (redemptionsRes.data || []).length,
      });
    } catch (err) {
      console.error('Error fetching admin referrals:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateReferralStatus = async (id: string, status: string, reason?: string) => {
    try {
      const update: any = { status };
      if (status === 'active') update.activated_at = new Date().toISOString();
      if (status === 'invalid') update.invalid_reason = reason;
      await supabase.from('referrals').update(update).eq('id', id);
      await fetchAll();
    } catch (err) {
      console.error('Error updating referral:', err);
    }
  };

  const reviewInvalidReferral = async (id: string, action: string) => {
    try {
      await supabase.from('invalid_referrals').update({
        reviewed: true, reviewed_at: new Date().toISOString(), review_action: action,
      }).eq('id', id);
      await fetchAll();
    } catch (err) {
      console.error('Error reviewing invalid referral:', err);
    }
  };

  const addFeaturedProduct = async (productId: string, days: number, reason: string, referrerId?: string) => {
    try {
      const endAt = new Date();
      endAt.setDate(endAt.getDate() + days);
      await supabase.from('featured_products').insert({
        product_id: productId, referrer_id: referrerId || null,
        issued_by: referrerId ? 'referral' : 'admin', reason,
        end_at: endAt.toISOString(),
      });
      await fetchAll();
    } catch (err) {
      console.error('Error adding featured product:', err);
    }
  };

  const removeFeaturedProduct = async (id: string) => {
    try {
      await supabase.from('featured_products').update({ is_active: false }).eq('id', id);
      await fetchAll();
    } catch (err) {
      console.error('Error removing featured product:', err);
    }
  };

  const approveRedemption = async (id: string, productId?: string) => {
    try {
      const redemption = redemptions.find((r: any) => r.id === id);
      if (!redemption) return;

      // Approve
      await (supabase as any).from('reward_redemptions').update({
        status: 'approved', reviewed_at: new Date().toISOString(), product_id: productId || null,
      }).eq('id', id);

      // If featured reward, add to featured_products
      if (redemption.reward_type === 'featured' && productId) {
        const days = redemption.task?.featured_duration_days || 7;
        await addFeaturedProduct(productId, days, `Task reward: ${redemption.task?.title || 'Completed task'}`, redemption.user_id);
      }

      // Notify user
      await supabase.from('notifications').insert({
        user_id: redemption.user_id,
        title: 'Reward Approved! 🎉',
        message: `Your ${redemption.reward_type} reward has been approved by admin.`,
        type: 'reward',
      });

      await fetchAll();
    } catch (err) {
      console.error('Error approving redemption:', err);
    }
  };

  const rejectRedemption = async (id: string, reason: string) => {
    try {
      const redemption = redemptions.find((r: any) => r.id === id);
      await (supabase as any).from('reward_redemptions').update({
        status: 'rejected', admin_notes: reason, reviewed_at: new Date().toISOString(),
      }).eq('id', id);

      if (redemption) {
        await supabase.from('notifications').insert({
          user_id: redemption.user_id,
          title: 'Reward Request Declined',
          message: `Your reward request was declined. Reason: ${reason}`,
          type: 'info',
        });
      }
      await fetchAll();
    } catch (err) {
      console.error('Error rejecting redemption:', err);
    }
  };

  const exportCSV = () => {
    const headers = ['Referrer', 'Referee', 'Code', 'Status', 'Created', 'Activated'];
    const rows = referrals.map((r: any) => [
      r.referrer?.full_name || '', r.referee?.full_name || '', r.referral_code,
      r.status, r.created_at?.slice(0, 10) || '', r.activated_at?.slice(0, 10) || '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `referrals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return {
    referrals, invalidReferrals, redemptions, stats, loading,
    updateReferralStatus, reviewInvalidReferral,
    addFeaturedProduct, removeFeaturedProduct,
    approveRedemption, rejectRedemption, exportCSV,
    refetch: fetchAll,
  };
};

// Seller redemption hook
export const useSellerRedemptions = () => {
  const { user } = useAuth();
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchRedemptions();
    else setLoading(false);
  }, [user]);

  const fetchRedemptions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from('reward_redemptions')
        .select('*, task:reward_tasks(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setRedemptions(data || []);
    } catch (err) {
      console.error('Error fetching redemptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const redeemTask = async (taskId: string, rewardType: string, productId?: string) => {
    if (!user) return { success: false, error: 'Not logged in' };
    try {
      const { error } = await (supabase as any).from('reward_redemptions').insert({
        user_id: user.id, task_id: taskId, reward_type: rewardType,
        product_id: productId || null, status: 'pending',
      });
      if (error) throw error;
      await fetchRedemptions();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  return { redemptions, loading, redeemTask, refetch: fetchRedemptions };
};
