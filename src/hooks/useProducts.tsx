import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
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
  video_thumbnail: string | null;
  tags: string[] | null;
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
  slug: string | null;
  // SEO fields
  seo_title: string | null;
  seo_description: string | null;
  seo_image: string | null;
  currency_code: string | null;
  currency_symbol: string | null;
  country: string | null;
  // Admin & Rental fields
  admin_posted: boolean | null;
  admin_phone: string | null;
  admin_location: string | null;
  show_connect_button: boolean | null;
  sponsored: boolean | null;
  last_edited_by: string | null;
  rental_fee: number | null;
  rental_unit: string | null;
  rental_status: string | null;
  discount: number | null;
  discount_expiry: string | null;
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
    slug?: string | null;
  } | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  type: string;
}

export const useProducts = (categoryType?: string, pageSize: number = 40) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const { profile } = useAuth();

  useEffect(() => {
    setProducts([]);
    setPage(0);
    setHasMore(true);
    fetchProducts(0);
  }, [categoryType, profile?.sector_id]);

  const fetchProducts = async (pageNum: number) => {
    try {
      if (pageNum === 0) setLoading(true);
      else setLoadingMore(true);

      let newData: Product[] = [];
      let usedStatic = false;

      // Page 0 + no category filter → serve entirely from CDN static.
      if (!categoryType && pageNum === 0) {
        const staticRows = await getContent<any[]>('products/latest');
        if (Array.isArray(staticRows)) {
          newData = staticRows as unknown as Product[];
          usedStatic = true;
        }
      }

      // Fallback to Supabase only when strict mode allows it OR the caller
      // is paginating past the static payload.
      if (!usedStatic && !isStrictStaticMode()) {
        const from = pageNum * pageSize;
        const to = from + pageSize - 1;
        let query = supabase
          .from('products')
          .select(PRODUCT_CARD_WITH_RELATIONS)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .range(from, to);
        if (categoryType) {
          const { data: categories } = await supabase
            .from('categories').select('slug').eq('type', categoryType);
          if (categories && categories.length > 0) {
            query = query.in('category', categories.map(c => c.slug));
          }
        }
        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;
        newData = (data || []) as unknown as Product[];
      }

      // Static payloads cover ~100 items — treat as full page.
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
      fetchProducts(page + 1);
    }
  };

  return { products, loading, loadingMore, error, hasMore, loadMore, refetch: () => { setPage(0); fetchProducts(0); } };
};

export const useProduct = (productId: string | undefined) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const fetchProduct = async () => {
    if (!productId) {
      setLoading(false);
      setError('No product ID provided');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('products')
        .select(`
          *,
          seller:profiles!products_seller_id_fkey(id, full_name, profile_image, whatsapp_number, call_number),
          shop:shops(id, name, logo_url, trading_center)
        `)
        .eq('id', productId)
        .maybeSingle();

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
      
      // Increment view count (ignore errors - non-critical)
      try {
        await supabase.rpc('increment_product_view', { product_uuid: productId });
      } catch {
        // Ignore view count errors
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

  return { product, loading, error, refetch: fetchProduct };
};

export const useCategories = (type?: string) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, [type]);

  const fetchCategories = async () => {
    try {
      let rows = await getContent<any[]>('categories/all');
      if (!Array.isArray(rows) && !isStrictStaticMode()) {
        let query = supabase.from('categories').select('*').order('name');
        if (type) query = query.eq('type', type);
        const { data } = await query;
        rows = data || [];
      }
      rows = rows ?? [];
      if (type) rows = rows.filter((c: any) => c.type === type);
      setCategories(rows as Category[]);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };


  return { categories, loading };
};

export const useMyProducts = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMyProducts();
    }
  }, [user]);

  const fetchMyProducts = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data } = await supabase
        .from('products')
        .select(`
          *,
          shop:shops(id, name, logo_url, trading_center)
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  return { products, loading, refetch: fetchMyProducts };
};

export const useFavorites = () => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    } else {
      setFavorites([]);
      setLoading(false);
    }
  }, [user]);

  const fetchFavorites = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('product_likes')
        .select('product_id')
        .eq('user_id', user.id);

      setFavorites(data?.map(f => f.product_id) || []);
    } catch (err) {
      console.error('Error fetching favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (productId: string) => {
    if (!user) return;

    const isFavorite = favorites.includes(productId);
    
    if (isFavorite) {
      await supabase
        .from('product_likes')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId);
      setFavorites(prev => prev.filter(id => id !== productId));
    } else {
      await supabase
        .from('product_likes')
        .insert({ user_id: user.id, product_id: productId });
      setFavorites(prev => [...prev, productId]);
    }
  };

  return { favorites, loading, toggleFavorite, isFavorite: (id: string) => favorites.includes(id) };
};
