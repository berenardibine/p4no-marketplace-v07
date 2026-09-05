import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PRODUCT_CARD_FIELDS, SERVICE_CARD_FIELDS, ARTICLE_CARD_FIELDS } from '@/lib/queryFields';
import { getCachedList } from '@/lib/productCache';
import { REDIS_ONLY } from '@/lib/cacheFlags';
import { getContent } from '@/lib/cdnGuard';
import { isStrictStaticMode } from '@/lib/staticFlags';
import { isFeatureEnabled } from '@/lib/featureFlags';


export type PopularItemType = 'product' | 'service' | 'reel' | 'article';

function currentWeekStartISO() {
  const d = new Date();
  const day = d.getUTCDay(); // 0=Sun
  // ISO week starts Monday (Postgres date_trunc('week') starts Mon)
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export const usePopularThisWeek = (itemType: PopularItemType, limit = 12) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // Feature Guard: module off → no static fetch, no DB read, nothing.
    if (!isFeatureEnabled('popular_this_week')
      || (itemType === 'reel' && !isFeatureEnabled('reels_module'))
      || (itemType === 'article' && !isFeatureEnabled('articles_module'))) {
      setItems([]);
      setLoading(false);
      return () => { active = false; };
    }
    (async () => {
      setLoading(true);

      // Static-first: try the pre-generated popular lists on the CDN.
      const staticPath =
        itemType === 'product' ? 'products/popular'
        : itemType === 'service' ? 'services/popular'
        : itemType === 'reel' ? 'reels/popular'
        : 'articles/popular';
      const staticRows = await getContent<any[]>(staticPath);
      if (Array.isArray(staticRows) && active) {
        setItems(staticRows.slice(0, limit));
        setLoading(false);
        return;
      }
      // Legacy Redis fallback for products only.
      if (itemType === 'product') {
        const cached = await getCachedList('popular');
        if (Array.isArray(cached) && cached.length > 0 && active) {
          setItems(cached.slice(0, limit));
          setLoading(false);
          return;
        }
      }
      if (isStrictStaticMode() || REDIS_ONLY) {
        if (active) { setItems([]); setLoading(false); }
        return;
      }

      const week = currentWeekStartISO();
      const { data: ranked } = await supabase

        .from('weekly_views')
        .select('item_id, view_count')
        .eq('item_type', itemType)
        .eq('week_start', week)
        .order('view_count', { ascending: false })
        .limit(limit);

      const ids = (ranked || []).map((r: any) => r.item_id);
      if (ids.length === 0) {
        if (active) { setItems([]); setLoading(false); }
        return;
      }

      const table = itemType === 'product' ? 'products'
        : itemType === 'service' ? 'services'
        : itemType === 'reel' ? 'reels'
        : 'insight_articles';

      const fields = itemType === 'product' ? PRODUCT_CARD_FIELDS
        : itemType === 'service' ? SERVICE_CARD_FIELDS
        : itemType === 'reel' ? 'id, title, thumbnail_url, video_url, views, likes, seller_id, created_at'
        : ARTICLE_CARD_FIELDS;

      const { data: rows } = await (supabase.from(table as any) as any).select(fields).in('id', ids);
      const map = new Map(((rows as any[]) || []).map((r: any) => [r.id, r]));
      const ordered = ids.map((id) => map.get(id)).filter(Boolean);
      if (active) { setItems(ordered as any[]); setLoading(false); }
    })();
    return () => { active = false; };
  }, [itemType, limit]);

  return { items, loading };
};

// Public weekly view counting is permanently disabled (no RPC, no DB write).
export const trackWeeklyView = async (_itemType: PopularItemType, _itemId: string) => {};
