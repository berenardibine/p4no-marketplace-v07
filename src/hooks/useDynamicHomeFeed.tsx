import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCachedList, getCachedCategories } from '@/lib/productCache';
import { REDIS_ONLY } from '@/lib/cacheFlags';

interface Product {
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
  discount: number | null;
  discount_expiry: string | null;
  location?: string | null;
  seller?: {
    id: string;
    full_name: string;
    profile_image: string | null;
  } | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  type: string | null;
}

interface CategorySection {
  category: Category;
  products: Product[];
  color: string;
}

// Category color gradients
const categoryColors = [
  'from-orange-500 to-amber-400',
  'from-green-500 to-emerald-400',
  'from-blue-500 to-cyan-400',
  'from-purple-500 to-violet-400',
  'from-pink-500 to-rose-400',
  'from-teal-500 to-green-400',
  'from-indigo-500 to-blue-400',
  'from-red-500 to-orange-400',
];

// Icon mapping
const iconMap: Record<string, string> = {
  'asset': '🏠',
  'agriculture': '🌾',
  'rent': '🔧',
  'electronics': '💻',
  'fashion': '👕',
  'food': '🍔',
  'health': '💪',
  'furniture': '🛋️',
  'default': '📦',
};

// Fisher-Yates shuffle
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Cache key
const SHUFFLE_CACHE_KEY = 'home_feed_cache';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

export const useDynamicHomeFeed = (userCountry?: string | null) => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categorySections, setCategorySections] = useState<CategorySection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 40;
  const hasShuffledRef = useRef(false);
  // Per-country prefetched pages held in memory for instant append
  const prefetchedRef = useRef<Map<string, Product[]>>(new Map());
  const inflightRef = useRef<Set<string>>(new Set());

  const pageKey = (p: number) => `${userCountry || 'all'}::${p}`;

  const fetchPageRaw = async (p: number): Promise<Product[]> => {
    // Redis-first for the unfiltered global feed; only country-filtered
    // pages go to the DB (Redis doesn't hold per-country slices yet).
    if (!userCountry) {
      try {
        const cached = await getCachedList('latest', p, PAGE_SIZE);
        if (Array.isArray(cached)) return cached as unknown as Product[];
      } catch (e) {
        if (REDIS_ONLY) throw e;
        /* fall through */
      }
      if (REDIS_ONLY) return [];
    }
    const from = p * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = supabase
      .from('products')
      .select(`
        id, title, price, images, category, created_at, views, likes, location,
        rental_unit, sponsored, product_type, country, currency_code,
        currency_symbol, is_negotiable, admin_posted, discount, discount_expiry,
        seller:profiles!products_seller_id_fkey(id, full_name, profile_image)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(from, to);
    if (userCountry) q = q.eq('country', userCountry);
    const { data } = await q;
    return (data || []) as Product[];
  };

  const prefetchPage = (p: number) => {
    const key = pageKey(p);
    if (prefetchedRef.current.has(key) || inflightRef.current.has(key)) return;
    inflightRef.current.add(key);
    fetchPageRaw(p)
      .then((rows) => {
        if (rows.length) prefetchedRef.current.set(key, rows);
      })
      .catch(() => {})
      .finally(() => inflightRef.current.delete(key));
  };

  // Check cache validity
  const isCacheValid = useMemo(() => {
    const cached = sessionStorage.getItem(SHUFFLE_CACHE_KEY);
    if (cached) {
      const timestamp = parseInt(cached, 10);
      return Date.now() - timestamp < CACHE_DURATION;
    }
    return false;
  }, []);

  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (isInitialLoad.current) {
      fetchData();
    } else {
      // Don't show loading skeleton on country change refetch
      fetchDataSilent();
    }
  }, [userCountry]);

  const fetchDataSilent = async () => {
    try {
      await fetchDataInternal(false);
    } catch (error) {
      console.error('Error fetching home feed:', error);
    }
  };

  const fetchData = async () => {
    try {
      await fetchDataInternal(true);
    } catch (error) {
      console.error('Error fetching home feed:', error);
    }
  };

  const buildSections = (products: Product[], cats: Category[]) => {
    const sections: CategorySection[] = [];
    const categoriesWithProducts = cats.filter(cat =>
      products.some(p => p.category === cat.slug)
    );
    const shuffledCats = shuffleArray(categoriesWithProducts);
    shuffledCats.forEach((cat, index) => {
      const categoryProducts = products
        .filter(p => p.category === cat.slug)
        .slice(0, 12);
      if (categoryProducts.length >= 1) {
        sections.push({
          category: {
            ...cat,
            icon: cat.icon || iconMap[cat.type || 'default'] || iconMap['default'],
          },
          products: categoryProducts,
          color: categoryColors[index % categoryColors.length],
        });
      }
    });
    return sections;
  };

  const applyFirstPage = (products: Product[], cats: Category[]) => {
    setCategories(cats);
    setPage(0);
    setHasMore(products.length === PAGE_SIZE);
    if (!hasShuffledRef.current || !isCacheValid) {
      setAllProducts(shuffleArray(products));
      hasShuffledRef.current = true;
      sessionStorage.setItem(SHUFFLE_CACHE_KEY, Date.now().toString());
    } else {
      setAllProducts(products);
    }
    setCategorySections(buildSections(products, cats));
  };

  const fetchDataInternal = async (showLoading: boolean) => {
    isInitialLoad.current = false;

    // 1) Instant first paint from Redis-backed cache (no country filter only)
    let paintedFromCache = false;
    if (!userCountry) {
      try {
        const cached = await getCachedList('latest', 0, PAGE_SIZE);
        if (Array.isArray(cached) && cached.length > 0) {
          const cachedProducts = cached as unknown as Product[];
          // Use cached categories if we already have them, else load from Redis
          let cats = categories;
          if (cats.length === 0) {
            const cachedCats = await getCachedCategories();
            cats = (cachedCats as unknown as Category[]) || [];
            if (cats.length === 0 && !REDIS_ONLY) {
              const { data: catData } = await supabase
                .from('categories')
                .select('id, name, slug, icon, type')
                .order('name');
              cats = (catData || []) as Category[];
            }
          }
          applyFirstPage(cachedProducts.slice(0, PAGE_SIZE), cats);
          setLoading(false);
          paintedFromCache = true;
          // Prefetch page 1 in background for instant scroll
          prefetchPage(1);
          return;
        }
      } catch (e) {
        if (REDIS_ONLY) throw e;
        // ignore, fall back to DB
      }
    }

    if (showLoading && !paintedFromCache) setLoading(true);

    try {
      // Country-filtered first page: DB (no per-country Redis slice yet)
      // Categories list: Redis-first.
      const [products, cachedCats] = await Promise.all([
        fetchPageRaw(0),
        getCachedCategories(),
      ]);
      let cats = (cachedCats as unknown as Category[]) || [];
      if (cats.length === 0 && !REDIS_ONLY) {
        const { data: catData } = await supabase
          .from('categories')
          .select('id, name, slug, icon, type')
          .order('name');
        cats = (catData || []) as Category[];
      }
      applyFirstPage(products, cats);
      // Always prefetch the next page after first load for smooth scroll
      prefetchPage(1);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    const next = page + 1;
    const key = pageKey(next);

    // Instant append if already prefetched
    const cached = prefetchedRef.current.get(key);
    if (cached && cached.length > 0) {
      prefetchedRef.current.delete(key);
      setAllProducts(prev => [...prev, ...cached]);
      setPage(next);
      setHasMore(cached.length === PAGE_SIZE);
      // Keep one page ahead warm
      prefetchPage(next + 1);
      return;
    }

    setLoadingMore(true);
    try {
      const more = await fetchPageRaw(next);
      setAllProducts(prev => [...prev, ...more]);
      setPage(next);
      setHasMore(more.length === PAGE_SIZE);
      // Warm the following page right away
      prefetchPage(next + 1);
    } catch (e) {
      console.error('loadMore error', e);
    } finally {
      setLoadingMore(false);
    }
  };

  // Build the dynamic feed: random products interspersed with category sections
  const dynamicFeed = useMemo(() => {
    const feed: Array<{ type: 'products' | 'category'; data: Product[] | CategorySection }> = [];
    const groupSize = 6;
    
    // Split random products into groups
    const productGroups: Product[][] = [];
    for (let i = 0; i < allProducts.length; i += groupSize) {
      productGroups.push(allProducts.slice(i, i + groupSize));
    }

    // Interleave product groups with category sections
    let categoryIndex = 0;
    productGroups.forEach((group, index) => {
      // Add product group
      feed.push({ type: 'products', data: group });
      
      // After each group, insert a category section if available
      if (categoryIndex < categorySections.length && index < productGroups.length - 1) {
        feed.push({ type: 'category', data: categorySections[categoryIndex] });
        categoryIndex++;
      }
    });

    return feed;
  }, [allProducts, categorySections]);

  // Specialized sections
  const newArrivals = useMemo(() => {
    return [...allProducts]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 8);
  }, [allProducts]);

  const assetProducts = useMemo(() => {
    return allProducts.filter(p => p.product_type === 'asset').slice(0, 8);
  }, [allProducts]);

  const agricultureProducts = useMemo(() => {
    return allProducts.filter(p => p.product_type === 'agriculture').slice(0, 8);
  }, [allProducts]);

  const rentProducts = useMemo(() => {
    return allProducts.filter(p => p.product_type === 'rent').slice(0, 8);
  }, [allProducts]);

  return {
    allProducts,
    categories,
    categorySections,
    dynamicFeed,
    newArrivals,
    assetProducts,
    agricultureProducts,
    rentProducts,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refetch: fetchData
  };
};

export default useDynamicHomeFeed;
