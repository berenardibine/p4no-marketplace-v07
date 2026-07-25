import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PRODUCT_CARD_WITH_RELATIONS } from '@/lib/queryFields';
import { assertRedisOnly } from '@/lib/cacheFlags';

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  images: string[];
  category: string | null;
  location: string | null;
  location_id: string | null;
  video_url: string | null;
  is_negotiable: boolean | null;
  product_type: string | null;
  status: string | null;
  views: number | null;
  likes: number | null;
  seller_id: string;
  shop_id: string | null;
  contact_whatsapp: string | null;
  contact_call: string | null;
  created_at: string | null;
  seller?: {
    id: string;
    full_name: string;
    profile_image: string | null;
    whatsapp_number: string | null;
    call_number: string | null;
  } | null;
  shop?: {
    id: string;
    name: string;
    logo_url: string | null;
    trading_center: string | null;
  } | null;
}

// Fisher-Yates shuffle algorithm
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Session key for caching shuffle
const SHUFFLE_CACHE_KEY = 'smart_market_shuffle_timestamp';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useRandomizedProducts = (category?: string) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Keep track of initial shuffle order
  const shuffledOrderRef = useRef<string[]>([]);
  const hasShuffledRef = useRef(false);

  // Check if we should use cached order
  const shouldReuseOrder = useMemo(() => {
    const cached = sessionStorage.getItem(SHUFFLE_CACHE_KEY);
    if (cached) {
      const timestamp = parseInt(cached, 10);
      return Date.now() - timestamp < CACHE_DURATION;
    }
    return false;
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [category]);

  const fetchProducts = async () => {
    try {
      assertRedisOnly('useRandomizedProducts', 'direct Supabase read for products is not allowed');
      setLoading(true);
      let query = supabase
        .from('products')
        .select(PRODUCT_CARD_WITH_RELATIONS)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const fetchedProducts = (data || []) as unknown as Product[];

      // Apply Fisher-Yates shuffle on page load
      if (!hasShuffledRef.current || !shouldReuseOrder) {
        const shuffled = shuffleArray(fetchedProducts);
        shuffledOrderRef.current = shuffled.map(p => p.id);
        hasShuffledRef.current = true;
        
        // Store timestamp for quick reload handling
        sessionStorage.setItem(SHUFFLE_CACHE_KEY, Date.now().toString());
        
        setProducts(shuffled);
      } else {
        // Maintain existing order during scroll
        const orderedProducts = shuffledOrderRef.current
          .map(id => fetchedProducts.find(p => p.id === id))
          .filter(Boolean) as Product[];
        
        // Add any new products that weren't in the original order
        const newProducts = fetchedProducts.filter(
          p => !shuffledOrderRef.current.includes(p.id)
        );
        
        setProducts([...orderedProducts, ...newProducts]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { products, loading, error, refetch: fetchProducts };
};
