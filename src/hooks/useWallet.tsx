import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

export const useWallet = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWallet = useCallback(async () => {
    if (!user) { setWallet(null); setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setWallet(data);
      } else {
        // Create wallet
        const { data: newWallet } = await (supabase as any)
          .from('wallets')
          .insert({ user_id: user.id, balance: 0 })
          .select()
          .single();
        setWallet(newWallet);
      }
    } catch (err) {
      console.error('Error fetching wallet:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setTransactions(data || []);
  }, [user]);

  useEffect(() => {
    fetchWallet();
    fetchTransactions();
  }, [fetchWallet, fetchTransactions]);

  return { wallet, transactions, loading, refetch: () => { fetchWallet(); fetchTransactions(); } };
};

export const useBoostPlans = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await (supabase as any)
        .from('boost_plans')
        .select('*')
        .eq('is_active', true)
        .order('duration_days', { ascending: true });
      setPlans(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  return { plans, loading };
};

export const useAdminBoostPlans = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('boost_plans')
      .select('*')
      .order('duration_days', { ascending: true });
    setPlans(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const createPlan = async (plan: { name: string; duration_days: number; cost_points: number }) => {
    const { error } = await (supabase as any).from('boost_plans').insert(plan);
    if (error) throw error;
    await fetchPlans();
  };

  const updatePlan = async (id: string, updates: any) => {
    const { error } = await (supabase as any).from('boost_plans').update(updates).eq('id', id);
    if (error) throw error;
    await fetchPlans();
  };

  const deletePlan = async (id: string) => {
    await (supabase as any).from('boost_plans').delete().eq('id', id);
    await fetchPlans();
  };

  return { plans, loading, createPlan, updatePlan, deletePlan, refetch: fetchPlans };
};
