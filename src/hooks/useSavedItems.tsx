import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type SavedItemType = 'product' | 'service';

export const useSavedItem = (itemType: SavedItemType, itemId?: string | null) => {
  const { user } = useAuth();
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !itemId) { setIsSaved(false); return; }
    const { data } = await supabase
      .from('saved_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('item_type', itemType)
      .eq('item_id', itemId)
      .maybeSingle();
    setIsSaved(!!data);
  }, [user, itemType, itemId]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async () => {
    if (!user || !itemId) return false;
    setLoading(true);
    try {
      if (isSaved) {
        await supabase.from('saved_items').delete()
          .eq('user_id', user.id).eq('item_type', itemType).eq('item_id', itemId);
      } else {
        await supabase.from('saved_items').insert({
          user_id: user.id, item_type: itemType, item_id: itemId,
        });
      }
      await refresh();
      return true;
    } finally { setLoading(false); }
  };

  return { isSaved, loading, toggle };
};

export const useSavedItemsList = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) { setProducts([]); setServices([]); setLoading(false); return; }
    setLoading(true);
    const { data: saved } = await supabase
      .from('saved_items')
      .select('item_type, item_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const productIds = saved?.filter(s => s.item_type === 'product').map(s => s.item_id) || [];
    const serviceIds = saved?.filter(s => s.item_type === 'service').map(s => s.item_id) || [];

    const [{ data: p }, { data: s }] = await Promise.all([
      productIds.length
        ? supabase.from('products').select('*').in('id', productIds)
        : Promise.resolve({ data: [] as any[] }),
      serviceIds.length
        ? supabase.from('services').select('*').in('id', serviceIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    setProducts(p || []);
    setServices(s || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  return { products, services, loading, refetch: fetch };
};
