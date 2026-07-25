import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCachedList, getCachedCategory } from '@/lib/productCache';

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  category: string | null;
  created_at: string | null;
  views: number | null;
  likes: number | null;
  seller: {
    id: string;
    full_name: string;
    profile_image: string | null;
  } | null;
}

interface Ad {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link: string | null;
  bg_color: string | null;
  text_color: string | null;
  type: string;
}

export const useHomeSections = (categoryFilter?: string) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [categoryFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Redis-first: products from cache edge function; ads stay on Supabase
      // (time-windowed, low volume, not worth caching).
      const productsPromise = categoryFilter && categoryFilter !== 'all'
        ? getCachedCategory(categoryFilter, 0, 100)
        : getCachedList('latest', 0, 100);

      const [cachedProducts, adsRes] = await Promise.all([
        productsPromise,
        supabase
          .from('ads')
          .select('id, title, description, image_url, link, bg_color, text_color, type')
          .eq('is_active', true)
          .gte('end_date', new Date().toISOString())
          .lte('start_date', new Date().toISOString())
          .order('priority', { ascending: false })
          .limit(5)
      ]);

      if (Array.isArray(cachedProducts)) {
        setProducts(cachedProducts as unknown as Product[]);
      }
      if (adsRes.data) {
        setAds(adsRes.data);
      }
    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic sections based on data
  const sections = useMemo(() => {
    // Trending: Products with most views/likes
    const trending = [...products]
      .sort((a, b) => ((b.views || 0) + (b.likes || 0) * 3) - ((a.views || 0) + (a.likes || 0) * 3))
      .slice(0, 12);

    // New Arrivals: Most recently added
    const newArrivals = [...products]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 12);

    // Just For You: Randomized selection
    const justForYou = [...products]
      .sort(() => Math.random() - 0.5)
      .slice(0, 12);

    // Best Deals: Lower priced items (potential deals)
    const bestDeals = [...products]
      .sort((a, b) => a.price - b.price)
      .slice(0, 8);

    // Popular Sellers: Group by seller and count products
    const sellerCounts = products.reduce((acc, p) => {
      if (p.seller?.id) {
        acc[p.seller.id] = (acc[p.seller.id] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const topSellers = Object.entries(sellerCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([sellerId]) => {
        const product = products.find(p => p.seller?.id === sellerId);
        return product?.seller;
      })
      .filter(Boolean);

    return {
      trending,
      newArrivals,
      justForYou,
      bestDeals,
      topSellers,
      allProducts: products,
      ads
    };
  }, [products, ads]);

  return {
    ...sections,
    loading,
    refetch: fetchData
  };
};

export default useHomeSections;