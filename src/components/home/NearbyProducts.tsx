import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, ChevronLeft, ChevronRight, Navigation, RefreshCw } from 'lucide-react';
import { useNearbyProducts } from '@/hooks/useNearbyProducts';
import FloatingProductCard from './FloatingProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useGeoLocation } from '@/hooks/useGeoLocation';

interface NearbyProductsProps {
  lat: number | null;
  lng: number | null;
  permissionDenied?: boolean;
  onRequestPermission?: () => void;
}

const formatDistance = (meters: number): string => {
  if (meters < 100) return `${Math.round(meters)}m away`;
  if (meters < 1000) return `${Math.round(meters)}m away`;
  return `${(meters / 1000).toFixed(1)}km away`;
};

const NearbyProducts = ({ lat, lng, permissionDenied, onRequestPermission }: NearbyProductsProps) => {
  const { country } = useGeoLocation();
  const countryFilterEnabled = localStorage.getItem('p4no_country_filter') === 'true';

  const { products, loading, hasMore, refetch } = useNearbyProducts({
    lat,
    lng,
    radiusM: 10000,
    maxResults: 12,
    countryFilter: countryFilterEnabled ? (country || null) : null,
  });
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll every 3 seconds
  useEffect(() => {
    if (isPaused || products.length <= 2) return;
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % Math.ceil(products.length / 2));
    }, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPaused, products.length]);

  useEffect(() => {
    if (scrollRef.current && products.length > 0) {
      const cardWidth = 180;
      const gap = 12;
      scrollRef.current.scrollTo({
        left: currentIndex * (cardWidth * 2 + gap),
        behavior: 'smooth',
      });
    }
  }, [currentIndex, products.length]);

  const handlePrev = useCallback(() => {
    const maxIdx = Math.ceil(products.length / 2);
    setCurrentIndex(prev => (prev - 1 + maxIdx) % maxIdx);
  }, [products.length]);

  const handleNext = useCallback(() => {
    const maxIdx = Math.ceil(products.length / 2);
    setCurrentIndex(prev => (prev + 1) % maxIdx);
  }, [products.length]);

  // Permission denied state
  if (permissionDenied && !lat) {
    return (
      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Navigation className="h-5 w-5 text-primary" />
          Products Near You
        </h3>
        <div className="bg-muted/50 rounded-2xl p-6 text-center space-y-3">
          <MapPin className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Enable location access to discover products near you
          </p>
          {onRequestPermission && (
            <Button size="sm" variant="outline" onClick={onRequestPermission}>
              <Navigation className="h-4 w-4 mr-2" />
              Enable Location
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Navigation className="h-5 w-5 text-primary" />
          Products Near You
        </h3>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="w-[180px] shrink-0 space-y-2">
              <Skeleton className="aspect-square rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0 && lat !== null) {
    return (
      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Navigation className="h-5 w-5 text-primary" />
          Products Near You
        </h3>
        <div className="bg-muted/30 rounded-2xl p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No products found within 10km. Check back later!
          </p>
          <Button size="sm" variant="ghost" className="mt-2" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <div
      className="space-y-3"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Navigation className="h-5 w-5 text-primary" />
          Products Near You
          <span className="text-xs text-muted-foreground font-normal">
            ({products.length} nearby)
          </span>
        </h3>
        <div className="flex gap-1">
          <button
            onClick={handlePrev}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={handleNext}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
      >
        {products.map((product) => (
          <div key={product.id} className="w-[180px] shrink-0">
            <FloatingProductCard
              id={product.id}
              slug={product.slug || undefined}
              title={product.title}
              price={product.price}
              images={product.images}
              rentalUnit={product.rental_unit}
              isSponsored={product.sponsored}
              isAdminPosted={product.admin_posted}
              isNegotiable={product.is_negotiable}
              currencySymbol={product.currency_symbol}
              badgeLabel="NEARBY"
              badgeTone="new"
              refSource="nearby"
            />
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {formatDistance(product.distance_m)}
            </p>
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      {products.length > 4 && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: Math.ceil(products.length / 2) }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                i === currentIndex
                  ? 'bg-primary w-6'
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
              )}
              aria-label={`Go to group ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default NearbyProducts;
