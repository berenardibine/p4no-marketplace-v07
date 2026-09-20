import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Store, MapPin, Package, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getContent } from '@/lib/cdnGuard';
import { supabase } from '@/integrations/supabase/client';

interface ShopCard {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  logo_url: string | null;
  trading_center: string | null;
  is_active: boolean | null;
  product_count?: number | null;
}

const AvailableShopsPage = () => {
  const navigate = useNavigate();
  const [shops, setShops] = useState<ShopCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // One lightweight static/CDN read. No per-card requests, no polling.
        let rows = await getContent<ShopCard[]>('shops/active');
        if (!Array.isArray(rows)) {
          const { data } = await supabase
            .from('shops')
            .select('id, name, description, logo_url, trading_center, is_active')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(200);
          rows = (data || []) as ShopCard[];
        }
        if (!cancelled) setShops(rows.filter((s) => s.is_active !== false));
      } catch (err) {
        console.error('Error loading shops:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return shops;
    return shops.filter(
      (s) =>
        s.name?.toLowerCase().includes(term) ||
        (s.trading_center || '').toLowerCase().includes(term)
    );
  }, [shops, q]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center gap-3 h-14 px-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-bold text-base flex-1">Available Shops</h1>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-4 space-y-5">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search shops"
            className="pl-9 h-11 rounded-xl"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-muted/30 rounded-3xl">
            <Store className="h-14 w-14 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="font-semibold text-lg mb-1">No Shops Found</h2>
            <p className="text-sm text-muted-foreground">Try a different search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filtered.map((shop) => (
              <article
                key={shop.id}
                className="group overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated motion-reduce:transform-none motion-reduce:transition-none"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                  {shop.logo_url ? (
                    <img
                      src={shop.logo_url}
                      alt={`${shop.name} cover`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-accent">
                      <Store className="h-12 w-12 text-primary/60" />
                    </div>
                  )}
                  <Badge className="absolute right-3 top-3 border-primary/20 bg-background/90 text-primary shadow-xs backdrop-blur-sm hover:bg-background/90">
                    Active
                  </Badge>
                </div>

                <div className="relative flex min-h-52 flex-col px-4 pb-4 pt-10">
                  <div className="absolute -top-8 left-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-muted shadow-soft">
                    {shop.logo_url ? (
                      <img
                        src={shop.logo_url}
                        alt={`${shop.name} logo`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Store className="h-7 w-7 text-primary" />
                    )}
                  </div>

                  <h3 className="truncate text-lg font-bold text-card-foreground">{shop.name}</h3>
                  {shop.description && (
                    <p className="mt-1.5 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
                      {shop.description}
                    </p>
                  )}
                  <div className="mt-3 flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {shop.trading_center && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                        {shop.trading_center}
                      </span>
                    )}
                    {typeof shop.product_count === 'number' && (
                      <span className="flex items-center gap-1">
                        <Package className="h-3.5 w-3.5 text-primary" />
                        {shop.product_count} {shop.product_count === 1 ? 'product' : 'products'}
                      </span>
                    )}
                  </div>
                  <Button
                    className="mt-auto w-full justify-between rounded-lg"
                    onClick={() => navigate(`/shop/${shop.id}`)}
                  >
                    View Shop
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>


    </div>
  );
};

export default AvailableShopsPage;
