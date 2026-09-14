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
const TTL = 30 * 60_000;

export function getActiveAds(): Promise<ActiveAd[]> {
  // Stable key so the persisted copy survives reloads (bucketed keys forced a
  // fresh PostgREST read every window even when a valid answer was on disk).
  return cachedQuery<ActiveAd[]>(
    'ads:active:v1',
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
