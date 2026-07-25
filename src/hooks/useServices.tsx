import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SERVICE_CARD_WITH_RELATIONS, SERVICE_CARD_FIELDS } from '@/lib/queryFields';
import { getContent } from '@/lib/cdnGuard';
import { isStrictStaticMode } from '@/lib/staticFlags';


export interface Service {
  id: string;
  seller_id: string;
  title: string;
  slug: string | null;
  category: string | null;
  short_description: string | null;
  description: string;
  pricing_type: 'fixed' | 'negotiable' | 'starting_from';
  price: number | null;
  currency_symbol: string | null;
  currency_code: string | null;
  location: string | null;
  country: string | null;
  whatsapp_number: string | null;
  phone_number: string | null;
  images: string[];
  video_url: string | null;
  video_thumbnail: string | null;
  years_experience: number | null;
  availability: string | null;
  portfolio_links: string[] | null;
  status: string;
  is_featured: boolean;
  views: number;
  likes: number;
  created_at: string;
  updated_at: string;
  seller?: {
    id: string;
    full_name: string;
    profile_image: string | null;
    identity_verified: boolean | null;
    rating: number | null;
    rating_count: number | null;
    whatsapp_number: string | null;
    call_number: string | null;
  };
}

interface UseServicesOptions {
  category?: string;
  featured?: boolean;
  limit?: number;
  sellerId?: string;
  search?: string;
  trending?: boolean;
}

export function useServices(opts: UseServicesOptions = {}) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    // Static-first for all public listings.
    if (!opts.sellerId && !opts.search) {
      const kind = opts.featured ? 'featured' : opts.trending ? 'trending' : 'latest';
      const path = opts.category ? `services/category/${opts.category}` : `services/${kind}`;
      const staticRows = await getContent<any[]>(path);
      if (Array.isArray(staticRows)) {
        const sliced = opts.limit ? staticRows.slice(0, opts.limit) : staticRows;
        setServices(sliced as any);
        setLoading(false);
        return;
      }
      if (isStrictStaticMode()) {
        setError('Content is updating');
        setServices([]);
        setLoading(false);
        return;
      }
    }


    let q = supabase
      .from('services')
      .select(SERVICE_CARD_WITH_RELATIONS)
      .eq('status', 'active');

    if (opts.category) q = q.eq('category', opts.category);
    if (opts.featured) q = q.eq('is_featured', true);
    if (opts.sellerId) q = q.eq('seller_id', opts.sellerId);
    if (opts.search) q = q.ilike('title', `%${opts.search}%`);

    if (opts.trending) {
      q = q.order('views', { ascending: false });
    } else {
      q = q.order('created_at', { ascending: false });
    }
    if (opts.limit) q = q.limit(opts.limit);

    // Fall back if FK alias not present
    let { data, error } = await q;
    if (error && /relationship/i.test(error.message)) {
      const fallback = await supabase
        .from('services')
        .select(SERVICE_CARD_FIELDS)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(opts.limit || 50);
      data = fallback.data as any;
      error = fallback.error as any;
      if (data?.length) {
        const ids = Array.from(new Set(data.map((s: any) => s.seller_id)));
        const { data: sellers } = await supabase
          .from('profiles')
          .select('id, full_name, profile_image, identity_verified, rating, rating_count, whatsapp_number, call_number')
          .in('id', ids);
        const map = new Map((sellers || []).map((s: any) => [s.id, s]));
        data = (data as any[]).map((s) => ({ ...s, seller: map.get(s.seller_id) }));
      }
    }

    if (error) setError(error.message);
    setServices((data as any) || []);
    setLoading(false);
  }, [opts.category, opts.featured, opts.limit, opts.sellerId, opts.search, opts.trending]);

  useEffect(() => { load(); }, [load]);

  return { services, loading, error, refetch: load };
}
