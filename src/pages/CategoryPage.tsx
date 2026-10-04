import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Plus, TrendingUp, Loader2, AlertCircle } from 'lucide-react';
import Header from '@/components/layout/Header';
import SearchModal from '@/components/layout/SearchModal';
import DashboardFABs from '@/components/layout/DashboardFABs';
import FloatingProductCard from '@/components/home/FloatingProductCard';
import HomeAds from '@/components/home/HomeAds';
import ProductFilterBar, { ProductFilters } from '@/components/filters/ProductFilterBar';
import PageMetaTags from '@/components/seo/PageMetaTags';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import { useAuth } from '@/hooks/useAuth';
import { useGeo } from '@/context/GeoContext';
import { getCachedCategory, getCachedList, getCachedCategories } from '@/lib/productCache';
import { getContent } from '@/lib/cdnGuard';
import { waitForPath } from '@/lib/staticCDN';
import { isStrictStaticMode } from '@/lib/staticFlags';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  rental_unit: string | null;
  sponsored: boolean | null;
  admin_posted: boolean | null;
  is_negotiable: boolean | null;
  currency_symbol: string | null;
}

interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_image: string | null;
}

const CategoryPage = () => {
  const { slug, page: pageParam } = useParams<{ slug: string; page?: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { country } = useGeo();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<CategoryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [trending, setTrending] = useState<Product[]>([]);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [otherProducts, setOtherProducts] = useState<Product[]>([]);
  const [otherPage, setOtherPage] = useState(0);
  const [hasMoreOther, setHasMoreOther] = useState(true);
  const [loadingOther, setLoadingOther] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const PAGE_SIZE = 20;
  const [filters, setFilters] = useState<ProductFilters>({ sortBy: 'random' });

  const isSeller = profile?.user_type === 'seller';

  useEffect(() => {
    if (slug) {
      setProducts([]);
      setOtherProducts([]);
      setOtherPage(0);
      setHasMoreOther(true);
      setPage(0);
      setHasMore(true);
      const initialPage = pageParam ? Math.max(0, parseInt(pageParam, 10) - 1) : 0;
      fetchCategoryProducts(initialPage, true);
    }
  }, [slug, country]);

  const fetchCategoryProducts = async (pageNum: number, isInitial = false) => {
    if (!slug) return;
    if (isInitial) setLoading(true); else setLoadingMore(true);
    try {
      let newItems: Product[] = [];
      // V4 static-first: use paginated category pages (40 per page) written
      // by the generator; fall back to the 100-item cached bucket for legacy
      // slugs that don't yet have paginated files.
      const staticPageIdx = Math.floor((pageNum * PAGE_SIZE) / 40);
      const staticPage = await getContent<Product[]>(
        `categories/${slug}/page-${staticPageIdx + 1}`,
      );
      if (Array.isArray(staticPage) && staticPage.length > 0) {
        const localOffset = (pageNum * PAGE_SIZE) - (staticPageIdx * 40);
        newItems = staticPage.slice(localOffset, localOffset + PAGE_SIZE);
        const idx = await getContent<{ total: number }>(`categories/${slug}/index`);
        if (idx?.total) setTotalCount(idx.total);
      } else if (pageNum === 0) {
        const cached = await getCachedCategory(slug, 0, 100);
        if (cached) {
          newItems = cached.slice(0, PAGE_SIZE) as Product[];
          setTotalCount(cached.length);
        } else {
          // Wait for a queued generation before ever asking PostgREST.
          // Only unknown-to-CDN but real categories can be mid-generation.
          const known = ((await getCachedCategories()) as any[] | null)?.some((c) => c.slug === slug);
          const built = known ? await waitForPath(`categories/${slug}/page-1`) : false;
          if (built) {
            const retry = await getContent<Product[]>(`categories/${slug}/page-1`);
            if (Array.isArray(retry)) newItems = retry.slice(0, PAGE_SIZE);
          }
        }
      }

      if (isInitial) {
        const allCats = await getCachedCategories();
        const match = Array.isArray(allCats)
          ? (allCats as any[]).find((c) => c.slug === slug)
          : null;
        if (match) {
          setCategory({
            id: match.id, name: match.name, slug: match.slug, icon: match.icon,
            seo_title: match.seo_title ?? null,
            seo_description: match.seo_description ?? null,
            seo_image: match.seo_image ?? null,
          });
        } else if (!isStrictStaticMode()) {
          const catRes = await supabase
            .from('categories')
            .select('id, name, slug, icon, seo_title, seo_description, seo_image')
            .eq('slug', slug)
            .maybeSingle();
          if (catRes.data) setCategory(catRes.data);
        }
      }

      setHasMore(newItems.length === PAGE_SIZE);
      setProducts(prev => isInitial ? newItems : [...prev, ...newItems]);
      setPage(pageNum);

      if (isInitial && newItems.length === 0) {
        const [trendCached, recCached] = await Promise.all([
          getCachedList('popular', 0, 100),
          getCachedList('latest', 0, 100),
        ]);
        setTrending(((trendCached || []) as Product[]).slice(0, 12));
        setRecommended(((recCached || []) as Product[]).filter((p: any) => p.category !== slug).slice(0, 24));
      }
    } catch (error) {
      console.error('Error fetching category products:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Infinite scroll observer
  const handleSentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (sentinelRef.current) {
      // disconnect prior observer if any (handled by re-creating)
    }
    sentinelRef.current = node;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loadingMore && !loading && !loadingOther) {
        if (hasMore) {
          fetchCategoryProducts(page + 1);
        } else if (hasMoreOther) {
          fetchOtherCategoryProducts(otherPage);
        }
      }
    }, { rootMargin: '400px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadingOther, hasMoreOther, page, otherPage, slug]);

  const fetchOtherCategoryProducts = async (pageNum: number) => {
    if (!slug) return;
    setLoadingOther(true);
    try {
      // Static-first: derive from the cached latest feed, excluding current category.
      const latest = await getCachedList('latest', 0, 200);
      const filtered = (Array.isArray(latest) ? latest : [])
        .filter((p: any) => p.category !== slug) as Product[];
      const from = pageNum * PAGE_SIZE;
      const items = filtered.slice(from, from + PAGE_SIZE);
      setHasMoreOther(items.length === PAGE_SIZE);
      setOtherProducts(prev => [...prev, ...items]);
      setOtherPage(pageNum + 1);
    } catch (e) {
      console.error('fetchOtherCategoryProducts error', e);
    } finally {
      setLoadingOther(false);
    }
  };

  const sortedProducts = [...products].sort((a, b) => {
    switch (filters.sortBy) {
      case 'price_low': return a.price - b.price;
      case 'price_high': return b.price - a.price;
      default: return 0;
    }
  });

  const ProductSkeleton = () => (
    <div className="bg-card rounded-2xl p-3 space-y-3 shadow-[0_6px_12px_rgba(0,0,0,0.08)]">
      <Skeleton className="aspect-square rounded-xl" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
    </div>
  );

  const metaTitle = category?.seo_title || `${category?.name || 'Category'} | p4no`;
  const metaDescription = category?.seo_description || `Explore the best ${category?.name || ''} products on p4no. Find high-quality items available worldwide.`;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
  const canonicalPath = currentPage === 1 ? `/category/${slug}` : `/category/${slug}/page/${currentPage}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 pb-8 pt-14">
      {category && (
        <PageMetaTags
          title={metaTitle}
          description={metaDescription}
          image={category.seo_image || undefined}
          url={canonicalPath}
        />
      )}
      {category && <CategoryPaginationLinks slug={slug!} currentPage={currentPage} totalPages={totalPages} />}
      {category && <CategoryFaqJsonLd category={category.name} />}
      <Header onSearchClick={() => setIsSearchOpen(true)} />

      <main className="container px-4 py-4 space-y-4">
        {category && (
          <Breadcrumbs
            items={[
              { name: 'Home', url: '/' },
              { name: 'Categories', url: '/' },
              { name: category.name, url: `/category/${category.slug}` },
              ...(currentPage > 1 ? [{ name: `Page ${currentPage}`, url: canonicalPath }] : []),
            ]}
            id="breadcrumb-category-jsonld"
          />
        )}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-xl">
            {category?.icon || '📦'}
          </div>
          <div>
            <h1 className="text-xl font-bold">{category?.name || 'Category'}</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading...' : `${products.length} product${products.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {category && (
          <section className="rounded-2xl bg-card/50 border border-border/40 p-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              Browse our curated selection of <strong className="text-foreground">{category.name}</strong> on P4NO —
              the global smarter-shopping marketplace. Compare prices from trusted sellers, watch product reels,
              and order directly from sellers worldwide. New {category.name.toLowerCase()} listings are added every day.
            </p>
          </section>
        )}

        <HomeAds />
        <ProductFilterBar filters={filters} onFiltersChange={setFilters} />

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => <ProductSkeleton key={i} />)}
          </div>
        ) : sortedProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {sortedProducts.map((product) => (
                <FloatingProductCard
                  key={product.id}
                  id={product.id}
                  title={product.title}
                  price={product.price}
                  images={product.images}
                  rentalUnit={product.rental_unit}
                  isSponsored={product.sponsored}
                  isAdminPosted={product.admin_posted}
                  isNegotiable={product.is_negotiable}
                  currencySymbol={product.currency_symbol}
                />
              ))}
            </div>
            {/* Sentinel for infinite scroll */}
            <div ref={handleSentinelRef} className="h-10 flex items-center justify-center">
              {(loadingMore || loadingOther) && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            </div>
            {/* When current category exhausted, show products from other categories */}
            {!hasMore && otherProducts.length > 0 && (
              <section className="space-y-3 pt-4 border-t border-border/30">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="font-bold text-base">More products you might like</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {otherProducts.map(p => (
                    <FloatingProductCard key={`o-${p.id}`} id={p.id} title={p.title} price={p.price} images={p.images}
                      rentalUnit={p.rental_unit} isSponsored={p.sponsored} isAdminPosted={p.admin_posted}
                      isNegotiable={p.is_negotiable} currencySymbol={p.currency_symbol} />
                  ))}
                </div>
              </section>
            )}
            {/* Hidden SEO pagination links */}
            {totalPages > 1 && (
              <nav aria-label="Pagination" className="sr-only">
                <ul>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <li key={i}>
                      <Link to={`/category/${slug}/page/${i + 1}`} rel={i === 0 ? 'first' : i === totalPages - 1 ? 'last' : undefined}>
                        Page {i + 1}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </>
        ) : (
          <div className="space-y-8">
            <div className="text-center py-10 bg-gradient-to-br from-amber-500/10 via-primary/5 to-secondary/5 rounded-2xl border border-amber-500/20">
              <div className="w-14 h-14 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="h-7 w-7 text-amber-600" />
              </div>
              <h3 className="font-bold text-lg mb-2">This category has no products yet</h3>
              <p className="text-muted-foreground mb-4 text-sm px-4">
                There are currently no listings in <span className="font-semibold text-foreground">{category?.name || 'this category'}</span>.
                Browse other products you might love below.
              </p>
              {isSeller ? (
                <Button onClick={() => navigate('/seller-dashboard')} className="rounded-full">
                  <Plus className="h-4 w-4 mr-2" /> List a product
                </Button>
              ) : (
                <Button onClick={() => navigate('/seller-dashboard')} variant="outline" className="rounded-full">
                  Become a seller
                </Button>
              )}
            </div>

            {trending.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h2 className="font-bold text-base">Trending products</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {trending.map(p => (
                    <FloatingProductCard key={p.id} id={p.id} title={p.title} price={p.price} images={p.images}
                      rentalUnit={p.rental_unit} isSponsored={p.sponsored} isAdminPosted={p.admin_posted}
                      isNegotiable={p.is_negotiable} currencySymbol={p.currency_symbol} />
                  ))}
                </div>
              </section>
            )}

            {recommended.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="font-bold text-base">Recommended for you</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {recommended.map(p => (
                    <FloatingProductCard key={p.id} id={p.id} title={p.title} price={p.price} images={p.images}
                      rentalUnit={p.rental_unit} isSponsored={p.sponsored} isAdminPosted={p.admin_posted}
                      isNegotiable={p.is_negotiable} currencySymbol={p.currency_symbol} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <DashboardFABs showSeller={isSeller} />
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
};

export default CategoryPage;

const CategoryPaginationLinks = ({ slug, currentPage, totalPages }: { slug: string; currentPage: number; totalPages: number }) => {
  useEffect(() => {
    const ensure = (rel: 'prev' | 'next', href: string | null) => {
      document.querySelector(`link[rel="${rel}"]`)?.remove();
      if (!href) return;
      const el = document.createElement('link');
      el.rel = rel;
      el.href = href;
      document.head.appendChild(el);
    };
    ensure('prev', currentPage > 1 ? (currentPage === 2 ? `/category/${slug}` : `/category/${slug}/page/${currentPage - 1}`) : null);
    ensure('next', currentPage < totalPages ? `/category/${slug}/page/${currentPage + 1}` : null);
    return () => {
      document.querySelector('link[rel="prev"]')?.remove();
      document.querySelector('link[rel="next"]')?.remove();
    };
  }, [slug, currentPage, totalPages]);
  return null;
};

const CategoryFaqJsonLd = ({ category }: { category: string }) => {
  useEffect(() => {
    const id = 'category-faq-jsonld';
    const data = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: `Where can I buy ${category} online?`,
          acceptedAnswer: { '@type': 'Answer', text: `You can browse and buy ${category} from trusted sellers worldwide on P4NO. Compare prices, read reviews and order directly from sellers.` },
        },
        {
          '@type': 'Question',
          name: `Is shopping for ${category} on P4NO safe?`,
          acceptedAnswer: { '@type': 'Answer', text: `Yes. P4NO verifies sellers, provides ratings and reviews, and supports direct contact via call, WhatsApp or chat before you order.` },
        },
        {
          '@type': 'Question',
          name: `How do I list ${category} for sale on P4NO?`,
          acceptedAnswer: { '@type': 'Answer', text: `Sign up, become a seller and create a product listing with photos or a short reel. Listings are reviewed and published worldwide.` },
        },
      ],
    };
    let s = document.getElementById(id) as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement('script');
      s.id = id;
      s.type = 'application/ld+json';
      document.head.appendChild(s);
    }
    s.textContent = JSON.stringify(data);
    return () => { document.getElementById(id)?.remove(); };
  }, [category]);
  return null;
};
