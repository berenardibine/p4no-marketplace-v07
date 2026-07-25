import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { assertRedisOnly } from '@/lib/cacheFlags';

interface NearbyProduct {
  id: string;
  title: string;
  price: number;
  images: string[];
  category: string | null;
  created_at: string | null;
  views: number | null;
  likes: number | null;
  rental_unit: string | null;
  sponsored: boolean | null;
  product_type: string | null;
  country: string | null;
  currency_code: string | null;
  currency_symbol: string | null;
  is_negotiable: boolean | null;
  admin_posted: boolean | null;
  lat: number | null;
  lng: number | null;
  distance_m: number;
  seller_id: string;
  slug: string | null;
}

interface UseNearbyProductsOptions {
  lat: number | null;
  lng: number | null;
  radiusM?: number;
  maxResults?: number;
  productType?: string | null;
  countryFilter?: string | null;
}

export const useNearbyProducts = ({
  lat,
  lng,
  radiusM = 10000,
  maxResults = 20,
  productType = null,
  countryFilter = null,
}: UseNearbyProductsOptions) => {
  const [products, setProducts] = useState<NearbyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const fetchNearby = useCallback(async () => {
    if (lat === null || lng === null) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      assertRedisOnly('useNearbyProducts', 'direct Supabase RPC for products is not allowed');
      const { data, error } = await supabase.rpc('get_nearby_products_postgis' as any, {
        b_lat: lat,
        b_lng: lng,
        radius_m: radiusM,
        limit_count: maxResults + 1,
      });

      if (error) throw error;

      let results = (data || []) as unknown as NearbyProduct[];

      // Filter by product type if specified
      if (productType) {
        results = results.filter(p => p.product_type === productType);
      }

      // Filter by country if enabled
      if (countryFilter) {
        results = results.filter(p => p.country === countryFilter);
      }

      setHasMore(results.length > maxResults);
      setProducts(results.slice(0, maxResults));
    } catch (err) {
      console.error('Error fetching nearby products:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [lat, lng, radiusM, maxResults, productType, countryFilter]);

  useEffect(() => {
    fetchNearby();
  }, [fetchNearby]);

  return {
    products,
    loading,
    hasMore,
    refetch: fetchNearby,
  };
};

export default useNearbyProducts;
