import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Store, MapPin, Package, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import BottomNav from '@/components/layout/BottomNav';
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

      <div className="px-4 pt-4 space-y-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-muted/30 rounded-3xl">
            <Store className="h-14 w-14 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="font-semibold text-lg mb-1">No Shops Found</h2>
            <p className="text-sm text-muted-foreground">Try a different search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((shop) => (
              <div
                key={shop.id}
                className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm flex gap-3"
              >
                <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {shop.logo_url ? (
                    <img
                      src={shop.logo_url}
                      alt={`${shop.name} logo`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Store className="h-7 w-7 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{shop.name}</h3>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                      Active
                    </Badge>
                  </div>
                  {shop.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {shop.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {shop.trading_center && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {shop.trading_center}
                      </span>
                    )}
                    {typeof shop.product_count === 'number' && (
                      <span className="flex items-center gap-1">
                        <Package className="h-3.5 w-3.5" />
                        {shop.product_count}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="mt-3 rounded-xl h-8 text-xs"
                    onClick={() => navigate(`/shop/${shop.id}`)}
                  >
                    View Shop
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default AvailableShopsPage;
