import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface BoostedProduct {
  id: string;
  product_id: string;
  seller_id: string;
  amount: number;
  duration_days: number;
  start_date: string;
  end_date: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  boost_plan_id: string | null;
  points_cost: number;
  product?: any;
}

export const useBoostedProducts = () => {
  const [boosts, setBoosts] = useState<BoostedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActiveBoosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('boosted_products')
        .select('*, product:products(id, title, images, price, slug, category, rental_unit, is_negotiable, sponsored)')
        .eq('status', 'active')
        .gt('end_date', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBoosts((data || []) as BoostedProduct[]);
    } catch (err) {
      console.error('Error fetching boosted products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveBoosts();
  }, [fetchActiveBoosts]);

  return { boosts, loading, refetch: fetchActiveBoosts };
};

export const useSellerBoosts = () => {
  const { user } = useAuth();
  const [boosts, setBoosts] = useState<BoostedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyBoosts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('boosted_products')
        .select('*, product:products(id, title, images, price)')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBoosts((data || []) as BoostedProduct[]);
    } catch (err) {
      console.error('Error fetching seller boosts:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyBoosts();
  }, [fetchMyBoosts]);

  const requestBoost = async (productId: string, durationDays: number, planId?: string, costPoints?: number) => {
    if (!user) throw new Error('Must be logged in');
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    const { error } = await supabase.from('boosted_products').insert({
      product_id: productId,
      seller_id: user.id,
      duration_days: durationDays,
      end_date: endDate.toISOString(),
      status: 'pending',
      boost_plan_id: planId || null,
      points_cost: costPoints || 0,
    } as any);
    if (error) throw error;
    await fetchMyBoosts();
  };

  return { boosts, loading, requestBoost, refetch: fetchMyBoosts };
};

export const useAdminBoosts = () => {
  const [boosts, setBoosts] = useState<BoostedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAllBoosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('boosted_products')
        .select('*, product:products(id, title, images, price), seller:profiles!boosted_products_seller_id_fkey(full_name, email)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBoosts((data || []) as any[]);
    } catch (err) {
      console.error('Error fetching all boosts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllBoosts();
  }, [fetchAllBoosts]);

  const updateBoostStatus = async (boostId: string, status: string, adminNotes?: string) => {
    const updateData: any = { status };
    if (adminNotes) updateData.admin_notes = adminNotes;
    if (status === 'active') updateData.start_date = new Date().toISOString();

    const { error } = await supabase.from('boosted_products').update(updateData).eq('id', boostId);
    if (error) throw error;

    // If approved, deduct points from seller wallet
    if (status === 'active') {
      const boost = boosts.find(b => b.id === boostId);
      if (boost && (boost as any).points_cost > 0) {
        // Deduct from wallet
        const { data: wallet } = await (supabase as any)
          .from('wallets')
          .select('*')
          .eq('user_id', boost.seller_id)
          .maybeSingle();

        if (wallet) {
          await (supabase as any)
            .from('wallets')
            .update({ balance: Math.max(0, wallet.balance - (boost as any).points_cost), updated_at: new Date().toISOString() })
            .eq('user_id', boost.seller_id);

          // Log transaction
          await (supabase as any)
            .from('wallet_transactions')
            .insert({
              user_id: boost.seller_id,
              amount: -(boost as any).points_cost,
              type: 'spend',
              description: `Boost product: ${boost.product?.title || 'Unknown'}`,
            });
        }
      }
    }

    await fetchAllBoosts();
  };

  return { boosts, loading, updateBoostStatus, refetch: fetchAllBoosts };
};
