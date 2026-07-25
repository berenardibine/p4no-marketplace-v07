import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PRODUCT_CARD_WITH_RELATIONS } from '@/lib/queryFields';
import { getContent } from '@/lib/cdnGuard';
import { isStrictStaticMode } from '@/lib/staticFlags';


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

export const useAllProducts = (category?: string, pageSize: number = 40) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setProducts([]);
    setPage(0);
    setHasMore(true);
    fetchAllProducts(0);
  }, [category]);

  const fetchAllProducts = async (pageNum: number) => {
    try {
      if (pageNum === 0) setLoading(true);
      else setLoadingMore(true);

      let newData: Product[] = [];
      let usedStatic = false;

      if (pageNum === 0) {
        const path = category && category !== 'all'
          ? `products/category/${category}`
          : 'products/latest';
        const staticRows = await getContent<any[]>(path);
        if (Array.isArray(staticRows)) {
          newData = staticRows as unknown as Product[];
          usedStatic = true;
        }
      }

      if (!usedStatic && !isStrictStaticMode()) {
        const from = pageNum * pageSize;
        const to = from + pageSize - 1;
        let query = supabase
          .from('products')
          .select(PRODUCT_CARD_WITH_RELATIONS)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .range(from, to);
        if (category && category !== 'all') query = query.eq('category', category);
        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;
        newData = (data || []) as unknown as Product[];
      }

      setHasMore(!usedStatic && newData.length === pageSize);

      if (pageNum === 0) {
        setProducts(newData);
      } else {
        setProducts(prev => [...prev, ...newData]);
      }
      setPage(pageNum);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };


  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchAllProducts(page + 1);
    }
  };

  return { products, loading, loadingMore, error, hasMore, loadMore, refetch: () => { setPage(0); fetchAllProducts(0); } };
};
