import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { assertRedisOnly } from '@/lib/cacheFlags';

export type UnifiedReelKind = 'product' | 'service';

export interface UnifiedReel {
  kind: UnifiedReelKind;
  id: string;
  title: string;
  description: string;
  price: number | null;
  currency_symbol: string | null;
  video_url: string;
  video_thumbnail: string | null;
  images: string[];
  slug: string | null;
  seller_id: string;
  shop_id: string | null;
  contact_call: string | null;
  contact_whatsapp: string | null;
  views: number | null;
  likes: number | null;
  category: string | null;
  shop?: { id: string; name: string; logo_url: string | null; slug: string | null } | null;
  seller?: { id: string; full_name: string; profile_image: string | null; whatsapp_number: string | null; call_number: string | null } | null;
}

export type UnifiedReelMode = 'latest' | 'trending' | 'foryou';
const PAGE_SIZE = 8;

const PRODUCT_SELECT = `
  id,title,description,price,currency_symbol,video_url,video_thumbnail,images,slug,
  seller_id,shop_id,contact_call,contact_whatsapp,views,likes,category,created_at,
  seller:profiles!products_seller_id_fkey(id, full_name, profile_image, whatsapp_number, call_number),
  shop:shops(id, name, logo_url, slug)
`;

const SERVICE_SELECT = `
  id,title,description,price,currency_symbol,video_url,video_thumbnail,images,slug,
  seller_id,phone_number,whatsapp_number,views,likes,category,created_at,
  seller:profiles!services_seller_id_fkey(id, full_name, profile_image, whatsapp_number, call_number)
`;

export const useUnifiedReels = (mode: UnifiedReelMode = 'foryou', startId?: string | null, kindFilter?: UnifiedReelKind) => {
  const [reels, setReels] = useState<UnifiedReel[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const seen = useRef(new Set<string>());

  const fetchPage = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      assertRedisOnly('useUnifiedReels', 'direct Supabase read for reels is not allowed');
      const from = pageRef.current * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const order = mode === 'trending' ? { col: 'views', asc: false } : { col: 'created_at', asc: false };

      const tasks: Promise<UnifiedReel[]>[] = [];

      if (kindFilter !== 'service') {
        tasks.push((async () => {
          let q = supabase
            .from('products')
            .select(PRODUCT_SELECT)
            .not('video_url', 'is', null)
            .neq('video_url', '')
            .eq('status', 'active');
          if (startId) q = q.neq('id', startId);
          q = q.order(order.col, { ascending: order.asc, nullsFirst: false }).range(from, to);
          const { data } = await q;
          return ((data || []) as any[]).map((p) => ({
            kind: 'product' as const,
            id: p.id, title: p.title, description: p.description, price: p.price,
            currency_symbol: p.currency_symbol, video_url: p.video_url, video_thumbnail: p.video_thumbnail,
            images: p.images || [], slug: p.slug, seller_id: p.seller_id, shop_id: p.shop_id,
            contact_call: p.contact_call, contact_whatsapp: p.contact_whatsapp,
            views: p.views, likes: p.likes, category: p.category, shop: p.shop, seller: p.seller,
          }));
        })());
      }

      if (kindFilter !== 'product') {
        tasks.push((async () => {
          let q = supabase
            .from('services')
            .select(SERVICE_SELECT)
            .not('video_url', 'is', null)
            .neq('video_url', '')
            .eq('status', 'active');
          if (startId) q = q.neq('id', startId);
          q = q.order(order.col, { ascending: order.asc, nullsFirst: false }).range(from, to);
          const { data } = await q;
          return ((data || []) as any[]).map((s) => ({
            kind: 'service' as const,
            id: s.id, title: s.title, description: s.description, price: s.price,
            currency_symbol: s.currency_symbol, video_url: s.video_url, video_thumbnail: s.video_thumbnail,
            images: s.images || [], slug: s.slug, seller_id: s.seller_id, shop_id: null,
            contact_call: s.phone_number, contact_whatsapp: s.whatsapp_number,
            views: s.views, likes: s.likes, category: s.category, shop: null, seller: s.seller,
          }));
        })());
      }

      const results = (await Promise.all(tasks)).flat();
      // shuffle/interleave for foryou
      const merged = mode === 'foryou'
        ? results.sort(() => Math.random() - 0.5)
        : results.sort((a, b) => (mode === 'trending' ? (b.views ?? 0) - (a.views ?? 0) : 0));

      const fresh = merged.filter(r => !seen.current.has(`${r.kind}:${r.id}`));
      fresh.forEach(r => seen.current.add(`${r.kind}:${r.id}`));
      setReels(prev => [...prev, ...fresh]);
      pageRef.current += 1;
      if (fresh.length < PAGE_SIZE) setHasMore(false);
    } catch (e) {
      console.error('unified reels error', e);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, mode, startId, kindFilter]);

  useEffect(() => {
    pageRef.current = 0;
    seen.current.clear();
    setReels([]);
    setHasMore(true);
    fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, startId, kindFilter]);

  return { reels, loading, hasMore, loadMore: fetchPage };
};
