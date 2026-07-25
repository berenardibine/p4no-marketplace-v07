import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product } from './useProducts';
import { getCachedProductDetail } from '@/lib/productCache';
import { REDIS_ONLY } from '@/lib/cacheFlags';


export const useProductBySlug = (slugOrId: string | undefined) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSlugBased, setIsSlugBased] = useState(false);

  useEffect(() => {
    if (slugOrId) {
      fetchProduct();
    }
  }, [slugOrId]);

  const fetchProduct = async () => {
    if (!slugOrId) {
      setLoading(false);
      setError('No product identifier provided');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);

      // Check if it's a UUID (old ID format) or a slug
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
      setIsSlugBased(!isUUID);

      // Redis-first: always go through cache edge function.
      // Edge function repopulates Redis on miss; falls back to DB only on outage.
      try {
        const cached = await getCachedProductDetail(slugOrId);
        if (cached) {
          setProduct(cached as unknown as Product);
          setLoading(false);
          return;
        }
      } catch (e) {
        if (REDIS_ONLY) throw e;
        /* network failure → DB fallback below */
      }

      if (REDIS_ONLY) {
        setError('Product not in Redis cache (REDIS_ONLY mode)');
        setProduct(null);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('products')

        .select(`
          *,
          seller:profiles!products_seller_id_fkey(id, full_name, profile_image, whatsapp_number, call_number, identity_verified),
          shop:shops(id, name, logo_url, trading_center, slug)
        `);
      
      if (isUUID) {
        query = query.eq('id', slugOrId);
      } else {
        query = query.eq('slug', slugOrId);
      }

      
      const { data, error: fetchError } = await query.maybeSingle();

      if (fetchError) {
        console.error('Error fetching product:', fetchError);
        setError(fetchError.message);
        setProduct(null);
        return;
      }
      
      if (!data) {
        setError('Product not found');
        setProduct(null);
        return;
      }
      
      setProduct(data);
    } catch (err: any) {
      console.error('Error fetching product:', err);
      setError(err.message || 'Failed to load product');
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  return { product, loading, error, isSlugBased, refetch: fetchProduct };
};
