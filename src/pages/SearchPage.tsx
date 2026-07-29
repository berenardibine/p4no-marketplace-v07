import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search as SearchIcon, Loader2 } from 'lucide-react';
import { getContent } from '@/lib/cdnGuard';
import Header from '@/components/layout/Header';
import SearchModal from '@/components/layout/SearchModal';
import FloatingProductCard from '@/components/home/FloatingProductCard';
import PageMetaTags from '@/components/seo/PageMetaTags';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

interface Product {
  id: string; title: string; price: number; images: string[];
  rental_unit: string | null; sponsored: boolean | null; admin_posted: boolean | null;
  is_negotiable: boolean | null; currency_symbol: string | null; slug: string | null;
}

const PAGE_SIZE = 24;

const SearchPage = () => {
  const { q: rawQ, page: pageParam } = useParams<{ q: string; page?: string }>();
  const q = decodeURIComponent(rawQ || '').trim();
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const currentPage = Math.max(1, parseInt(pageParam || '1', 10));

  useEffect(() => {
    if (!q) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    // Static-first: filter the pre-built CDN search index in-memory. Zero
    // PostgREST egress per query. Index is fetched once per session and
    // cached in IndexedDB by cdnGuard.
    (async () => {
      const index = (await getContent<any[]>('search/search-index')) || [];
      if (cancelled) return;
      const needle = q.toLowerCase();
      const matches = index
        .filter((r) => r?.kind === 'product' && typeof r.title === 'string' && r.title.toLowerCase().includes(needle))
        .map((r) => ({
          id: r.id,
          title: r.title,
          price: Number(r.price) || 0,
          images: r.thumb ? [r.thumb] : [],
          rental_unit: null,
          sponsored: null,
          admin_posted: null,
          is_negotiable: null,
          currency_symbol: null,
          slug: r.slug ?? null,
        })) as Product[];
      const from = (currentPage - 1) * PAGE_SIZE;
      setProducts(matches.slice(from, from + PAGE_SIZE));
      setTotalCount(matches.length);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [q, currentPage]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const canonical = currentPage === 1 ? `/search/${encodeURIComponent(q)}` : `/search/${encodeURIComponent(q)}/page/${currentPage}`;
  const title = `${q ? `"${q}"` : 'Search'} – Search Results | P4NO`;
  const description = q
    ? `Browse ${totalCount} results for "${q}" on P4NO. Shop products, services and reels from trusted sellers worldwide.`
    : 'Search products, services and reels on P4NO – the global smarter-shopping marketplace.';

  return (
    <div className="min-h-screen bg-background pb-8 pt-14">
      <PageMetaTags title={title} description={description} url={canonical} />
      {/* rel prev/next for paginated search */}
      <PrevNextLinks base={`/search/${encodeURIComponent(q)}`} currentPage={currentPage} totalPages={totalPages} />
      <Header onSearchClick={() => setIsSearchOpen(true)} />
      <main className="container px-4 py-4 space-y-4">
        <Breadcrumbs
          items={[
            { name: 'Home', url: '/' },
            { name: 'Search', url: '/search' },
            { name: q || 'All', url: canonical },
          ]}
          id="breadcrumb-search-jsonld"
        />
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <SearchIcon className="h-5 w-5 text-primary" />
              {q ? `Results for "${q}"` : 'Search'}
            </h1>
            {!loading && q && (
              <p className="text-sm text-muted-foreground">{totalCount} matching products</p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="font-medium mb-1">No products match your search</p>
            <p className="text-sm">Try different keywords or browse categories.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {products.map((p) => (
                <FloatingProductCard
                  key={p.id}
                  id={p.id}
                  title={p.title}
                  price={p.price}
                  images={p.images}
                  rentalUnit={p.rental_unit}
                  isSponsored={p.sponsored}
                  isAdminPosted={p.admin_posted}
                  isNegotiable={p.is_negotiable}
                  currencySymbol={p.currency_symbol}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <nav aria-label="Search pagination" className="flex items-center justify-center gap-2 pt-6 flex-wrap">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const n = i + 1;
                  const href = n === 1 ? `/search/${encodeURIComponent(q)}` : `/search/${encodeURIComponent(q)}/page/${n}`;
                  const isCurrent = n === currentPage;
                  return (
                    <Link
                      key={n}
                      to={href}
                      aria-current={isCurrent ? 'page' : undefined}
                      className={`px-3 py-1.5 rounded-full text-sm border ${
                        isCurrent ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'
                      }`}
                    >
                      {n}
                    </Link>
                  );
                })}
              </nav>
            )}
          </>
        )}
      </main>
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
};

const PrevNextLinks = ({ base, currentPage, totalPages }: { base: string; currentPage: number; totalPages: number }) => {
  useEffect(() => {
    const ensure = (rel: 'prev' | 'next', href: string | null) => {
      const existing = document.querySelector(`link[rel="${rel}"]`);
      if (!href) { existing?.remove(); return; }
      const el = (existing as HTMLLinkElement) || document.createElement('link');
      el.rel = rel;
      el.href = href;
      if (!existing) document.head.appendChild(el);
    };
    ensure('prev', currentPage > 1 ? (currentPage === 2 ? base : `${base}/page/${currentPage - 1}`) : null);
    ensure('next', currentPage < totalPages ? `${base}/page/${currentPage + 1}` : null);
    return () => {
      document.querySelector('link[rel="prev"]')?.remove();
      document.querySelector('link[rel="next"]')?.remove();
    };
  }, [base, currentPage, totalPages]);
  return null;
};

export default SearchPage;