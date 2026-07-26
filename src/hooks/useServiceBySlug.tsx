import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Service } from './useServices';
import { getCachedServiceDetail } from '@/lib/contentCache';
import { REDIS_ONLY } from '@/lib/cacheFlags';
import { waitForPath } from '@/lib/staticCDN';
import { isStrictStaticMode } from '@/lib/staticFlags';

export function useServiceBySlug(slugOrId: string | undefined) {
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!slugOrId) { setLoading(false); return; }
    (async () => {
      setLoading(true);

      // Static fields from Redis. Dynamic (views/ratings/comments/Q&A) stay on Supabase.
      const cached = await getCachedServiceDetail(slugOrId);
      if (cached) {
        if (!cancelled) {
          setService(cached as Service);
          setLoading(false);
        }
        return;
      }

      // V4: wait for a queued/running generation before ever touching the DB.
      try {
        const built = await waitForPath(`service/${slugOrId}`);
        if (built) {
          const retry = await getCachedServiceDetail(slugOrId);
          if (!cancelled && retry) {
            setService(retry as Service);
            setLoading(false);
            return;
          }
        }
      } catch { /* fall through */ }

      if (REDIS_ONLY || isStrictStaticMode()) {
        if (!cancelled) {
          setError('Service not found');
          setLoading(false);
        }
        return;
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
      const query = supabase.from('services').select('*');
      const { data, error } = await (isUuid ? query.eq('id', slugOrId) : query.eq('slug', slugOrId)).maybeSingle();
      if (cancelled) return;
      if (error) { setError(error.message); setLoading(false); return; }
      if (data) {
        const { data: seller } = await supabase
          .from('profiles')
          .select('id, full_name, profile_image, identity_verified, rating, rating_count, whatsapp_number, call_number, location, country, bio')
          .eq('id', (data as any).seller_id)
          .maybeSingle();
        setService({ ...(data as any), seller });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slugOrId]);

  return { service, loading, error };
}
