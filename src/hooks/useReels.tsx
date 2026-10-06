import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getContent } from '@/lib/cdnGuard';
import { isStrictStaticMode } from '@/lib/staticFlags';
import { isFeatureEnabled } from '@/lib/featureFlags';


export interface Reel {
  id: string;
  title: string;
  description: string;
  price: number;
  currency_symbol: string | null;
  video_url: string;
  video_thumbnail: string | null;
  images: string[];
  slug: string | null;
  seller_id: string;
  shop_id: string | null;
  contact_call: string | null;
  contact_whatsapp: string | null;
  minimum_quantity: number | null;
  unlimited_quantity: boolean | null;
  quantity: number;
  views: number | null;
  likes: number | null;
  admin_posted?: boolean | null;
  admin_shop_name?: string | null;
  shop?: { id: string; name: string; logo_url: string | null; slug: string | null } | null;
  seller?: { id: string; full_name: string; profile_image: string | null; whatsapp_number: string | null; call_number: string | null } | null;
}

const PAGE_SIZE = 8;
const SELECT = `
  id,title,description,price,currency_symbol,video_url,video_thumbnail,images,slug,
  seller_id,shop_id,contact_call,contact_whatsapp,minimum_quantity,unlimited_quantity,
  quantity,views,likes,admin_posted,admin_shop_name,
  seller:profiles!products_seller_id_fkey(id, full_name, profile_image),
  shop:shops(id, name, logo_url, slug)
`;

export type ReelMode = 'latest' | 'trending' | 'foryou';

export const useReels = (mode: ReelMode = 'foryou', startId?: string | null) => {
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const seenIds = useRef(new Set<string>());

  const fetchPage = useCallback(async () => {
    if (loading) return;
    // Feature Guard: Reels module off → behave as if reels do not exist.
    if (!isFeatureEnabled('reels_module')) {
      setHasMore(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const from = pageRef.current * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Fast path: serve static from CDN for default lists.
      if (!startId && (mode === 'latest' || mode === 'trending') && pageRef.current === 0) {
        const path = mode === 'trending' ? 'reels/trending' : 'reels/latest';
        const staticRows = await getContent<any[]>(path);
        if (Array.isArray(staticRows)) {
          const fresh = (staticRows as unknown as Reel[]).filter(r => !seenIds.current.has(r.id));
          fresh.forEach(r => seenIds.current.add(r.id));
          setReels(prev => [...prev, ...fresh]);
          pageRef.current += 1;
          setHasMore(false);
          setLoading(false);
          return;
        }
      }

      if (isStrictStaticMode() && !startId && mode !== 'foryou') {
        setHasMore(false);
        setLoading(false);
        return;
      }

      let q = supabase
        .from('products')
        .select(SELECT)
        .not('video_url', 'is', null)
        .neq('video_url', '')
        .eq('status', 'active');

      if (startId) q = q.neq('id', startId);

      if (mode === 'trending') q = q.order('views', { ascending: false, nullsFirst: false });
      else q = q.order('created_at', { ascending: false });

      const { data, error } = await q.range(from, to);
      if (error) throw error;

      const fresh = ((data || []) as unknown as Reel[]).filter(r => !seenIds.current.has(r.id));
      fresh.forEach(r => seenIds.current.add(r.id));
      setReels(prev => [...prev, ...fresh]);
      pageRef.current += 1;
      if (!data || data.length < PAGE_SIZE) setHasMore(false);
    } catch (e) {
      console.error('reels fetch error', e);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, mode, startId]);


  useEffect(() => {
    let cancelled = false;
    if (!isFeatureEnabled('reels_module')) { setReels([]); setHasMore(false); return; }
    pageRef.current = 0;
    seenIds.current.clear();
    setReels([]);
    setHasMore(true);

    const run = async () => {
      if (startId) {
        const { data } = await supabase
          .from('products')
          .select(SELECT)
          .eq('id', startId)
          .maybeSingle();
        if (cancelled) return;
        if (data && (data as any).video_url) {
          const first = data as unknown as Reel;
          seenIds.current.add(first.id);
          setReels([first]);
        }
      }
      fetchPage();
    };
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, startId]);

  return { reels, loading, hasMore, loadMore: fetchPage };
};
