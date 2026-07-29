import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getContent } from '@/lib/cdnGuard';
import { Store, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Shop {
  id: string;
  name: string;
  logo_url: string | null;
  trading_center: string | null;
  seller_id: string;
  country: string | null;
  description: string | null;
}

interface ShopNearMeProps {
  userCountry?: string;
}

const ShopNearMe = ({ userCountry }: ShopNearMeProps) => {
  const navigate = useNavigate();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchShops();
  }, [userCountry]);

  const fetchShops = async () => {
    try {
      // Zero-egress: shops list is a pre-built static file served from the
      // CDN and cached in IndexedDB. Never touches PostgREST.
      const all = (await getContent<Shop[]>('shops/all')) || [];
      const active = all.filter((s: any) => s?.is_active !== false);
      const scoped = userCountry ? active.filter((s) => s.country === userCountry) : active;
      const list = (scoped.length > 0 ? scoped : active).slice(0, 20);
      setShops(list);
    } catch (error) {
      console.error('Error fetching shops:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-scroll
  useEffect(() => {
    if (isPaused || shops.length <= 3) return;
    const interval = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        if (scrollLeft >= scrollWidth - clientWidth - 10) {
          scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollRef.current.scrollTo({ left: scrollLeft + 160, behavior: 'smooth' });
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isPaused, shops.length]);

  const handleScroll = useCallback((dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 300;
    scrollRef.current.scrollTo({
      left: scrollRef.current.scrollLeft + (dir === 'left' ? -amount : amount),
      behavior: 'smooth',
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          Featured Shops
        </h3>
        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="w-[140px] shrink-0 h-[170px] bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (shops.length === 0) return null;

  return (
    <div
      className="space-y-3"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <Store className="h-4 w-4 text-primary-foreground" />
          </div>
          <h3 className="font-bold text-base">Featured Shops</h3>
          <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {shops.length}
          </span>
        </div>
        {shops.length > 3 && (
          <div className="flex gap-1.5">
            <button
              onClick={() => handleScroll('left')}
              className="w-7 h-7 rounded-full bg-card border flex items-center justify-center hover:bg-accent transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleScroll('right')}
              className="w-7 h-7 rounded-full bg-card border flex items-center justify-center hover:bg-accent transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex gap-2.5 overflow-x-auto scrollbar-hide scroll-smooth pb-1"
      >
        {shops.map((shop) => (
          <button
            key={shop.id}
            onClick={() => navigate(`/shop/${shop.id}`)}
            className={cn(
              "w-[140px] shrink-0 rounded-2xl border bg-card overflow-hidden",
              "hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group text-left p-0"
            )}
          >
            {/* Shop Logo / Cover */}
            <div className="w-full aspect-square relative overflow-hidden bg-muted">
              {shop.logo_url ? (
                <img
                  src={shop.logo_url}
                  alt={shop.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                  <Store className="h-10 w-10 text-primary/40" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-2.5 space-y-1">
              <h4 className="font-semibold text-xs line-clamp-1 group-hover:text-primary transition-colors">
                {shop.name}
              </h4>
              {shop.trading_center && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 line-clamp-1">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  {shop.trading_center}
                </p>
              )}
              {shop.description && (
                <p className="text-[10px] text-muted-foreground line-clamp-1">
                  {shop.description}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ShopNearMe;
