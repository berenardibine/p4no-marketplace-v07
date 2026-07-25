import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PRODUCT_CARD_WITH_RELATIONS } from '@/lib/queryFields';
import { ProductFilters } from '@/components/filters/ProductFilterBar';
import { assertRedisOnly } from '@/lib/cacheFlags';

export interface FilteredProduct {
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
  rental_fee: number | null;
  rental_unit: string | null;
  rental_status: string | null;
  admin_posted: boolean | null;
  sponsored: boolean | null;
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

// Load saved filters from localStorage
const loadSavedFilters = (): ProductFilters => {
  try {
    const saved = localStorage.getItem('smartmarket_filters');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    // Ignore parse errors
  }
  return { sortBy: 'random' };
};

export const useFilteredProducts = (
  category?: string,
  filtersOrInitial?: ProductFilters,
  productType?: string // Add product_type filter
) => {
  const [products, setProducts] = useState<FilteredProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProductFilters>(
    filtersOrInitial || loadSavedFilters()
  );

  // Sync filters when passed from parent
  useEffect(() => {
    if (filtersOrInitial) {
      setFilters(filtersOrInitial);
    }
  }, [filtersOrInitial]);

  useEffect(() => {
    fetchProducts();
  }, [category, filters, productType]);

  const fetchProducts = async () => {
    try {
      assertRedisOnly('useFilteredProducts', 'direct Supabase read for products is not allowed');
      setLoading(true);
      setError(null);

      let query = supabase
        .from('products')
        .select(PRODUCT_CARD_WITH_RELATIONS)
        .eq('status', 'active');

      // Product type filter (for rent page)
      if (productType) {
        query = query.eq('product_type', productType);
      }

      // Category filter
      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      // Additional category from filters
      if (filters.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }

      // Price range filter
      if (filters.minPrice !== undefined) {
        query = query.gte('price', filters.minPrice);
      }
      if (filters.maxPrice !== undefined) {
        query = query.lte('price', filters.maxPrice);
      }

      // Location filter - we need to join with locations table
      if (filters.sectorId) {
        query = query.eq('location_id', filters.sectorId);
      } else if (filters.districtId) {
        // Get all sectors in the district, then filter
        const { data: sectors } = await supabase
          .from('sectors')
          .select('id')
          .eq('district_id', filters.districtId);
        
        if (sectors && sectors.length > 0) {
          query = query.in('location_id', sectors.map(s => s.id));
        }
      } else if (filters.provinceId) {
        // Get all districts in province, then sectors
        const { data: districts } = await supabase
          .from('districts')
          .select('id')
          .eq('province_id', filters.provinceId);
        
        if (districts && districts.length > 0) {
          const { data: sectors } = await supabase
            .from('sectors')
            .select('id')
            .in('district_id', districts.map(d => d.id));
          
          if (sectors && sectors.length > 0) {
            query = query.in('location_id', sectors.map(s => s.id));
          }
        }
      }

      // Sorting
      switch (filters.sortBy) {
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'price_low':
          query = query.order('price', { ascending: true });
          break;
        case 'price_high':
          query = query.order('price', { ascending: false });
          break;
        default:
          // Random - we'll handle this client-side after fetching
          query = query.order('created_at', { ascending: false });
      }

      const { data, error: fetchError } = await query.limit(100);

      if (fetchError) throw fetchError;

      let resultProducts = ((data || []) as unknown as FilteredProduct[]);

      // Apply random sorting client-side if needed
      if (filters.sortBy === 'random') {
        resultProducts = resultProducts.sort(() => Math.random() - 0.5);
      }

      // Prioritize sponsored products
      resultProducts = resultProducts.sort((a, b) => {
        if (a.sponsored && !b.sponsored) return -1;
        if (!a.sponsored && b.sponsored) return 1;
        return 0;
      });

      setProducts(resultProducts);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching filtered products:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    products,
    loading,
    error,
    filters,
    setFilters,
    refetch: fetchProducts
  };
};

export default useFilteredProducts;
