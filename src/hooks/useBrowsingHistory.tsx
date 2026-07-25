import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type HistoryItemType = 'product' | 'service' | 'article';

export const trackBrowsingHistory = async (itemType: HistoryItemType, itemId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.rpc('track_browsing_history' as any, { p_item_type: itemType, p_item_id: itemId });
  } catch { /* silent */ }
};

export const useBrowsingHistory = (itemType: HistoryItemType, limit = 30) => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data: rows } = await supabase
      .from('browsing_history')
      .select('item_id, viewed_at')
      .eq('user_id', user.id)
      .eq('item_type', itemType)
      .order('viewed_at', { ascending: false })
      .limit(limit);
    const ids = (rows || []).map((r: any) => r.item_id);
    if (ids.length === 0) { setItems([]); setLoading(false); return; }
    const table = itemType === 'product' ? 'products' : itemType === 'service' ? 'services' : 'insight_articles';
    const { data: detail } = await supabase.from(table as any).select('*').in('id', ids);
    const map = new Map((detail || []).map((d: any) => [d.id, d]));
    setItems(ids.map((id: string) => map.get(id)).filter(Boolean) as any);
    setLoading(false);
  }, [user, itemType, limit]);

  useEffect(() => { load(); }, [load]);

  const remove = async (itemId: string) => {
    if (!user) return;
    await supabase.from('browsing_history').delete().eq('user_id', user.id).eq('item_type', itemType).eq('item_id', itemId);
    load();
  };

  const clearAll = async () => {
    if (!user) return;
    await supabase.from('browsing_history').delete().eq('user_id', user.id).eq('item_type', itemType);
    load();
  };

  return { items, loading, remove, clearAll, refetch: load };
};