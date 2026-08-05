// Shared active-ads loader.
//
// HomeAds and useHomeSections both queried `ads` on mount, producing two
// identical PostgREST requests per homepage view. This module runs the query
// once, caches it for 10 minutes, and lets both callers filter client-side.

import { supabase } from '@/integrations/supabase/client';
import { cachedQuery } from '@/lib/queryCache';

export interface ActiveAd {
  id: string;
  title: string;
  description: string | null;
  type: string;
  image_url: string | null;
  link: string | null;
  bg_color: string | null;
  text_color: string | null;
  font_size: string | null;
  target_audience: string | null;
  priority: number | null;
}

const COLUMNS =
  'id,title,description,type,image_url,link,bg_color,text_color,font_size,target_audience,priority';
const TTL = 10 * 60_000;

export function getActiveAds(): Promise<ActiveAd[]> {
  // Bucket the "now" filter to 10-minute slots so the cache key is stable.
  const bucket = Math.floor(Date.now() / TTL);
  return cachedQuery<ActiveAd[]>(
    `ads:active:${bucket}`,
    async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('ads')
        .select(COLUMNS)
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .order('priority', { ascending: false });
      if (error) throw error;
      return (data as ActiveAd[]) ?? [];
    },
    { ttlMs: TTL },
  );
}

export function filterAdsForAudience(ads: ActiveAd[], userType: string | null | undefined): ActiveAd[] {
  const type = userType || 'buyer';
  return ads.filter((ad) => !ad.target_audience || ad.target_audience === 'all' || ad.target_audience === type);
}
