import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FloatingProductCard from './FloatingProductCard';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  rental_unit?: string | null;
  sponsored?: boolean | null;
  admin_posted?: boolean | null;
  is_negotiable?: boolean | null;
  currency_symbol?: string | null;
  discount?: number | null;
  discount_expiry?: string | null;
  location?: string | null;
}

interface AutoScrollCarouselProps {
  title: string;
  icon: string;
  color: string;
  products: Product[];
  viewAllLink?: string;
  autoScrollInterval?: number;
  badgeLabel?: string;
  badgeTone?: 'hot' | 'new' | 'trending' | 'best';
  refSource?: string;
}

const AutoScrollCarousel = ({
  title,
  icon,
  color,
  products,
  viewAllLink,
  autoScrollInterval = 3000,
  badgeLabel,
  badgeTone,
  refSource,
}: AutoScrollCarouselProps) => {
  const navigate = useNavigate();
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll with smooth looping
  useEffect(() => {
    if (isPaused || products.length <= 2) return;

    const interval = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        const maxScroll = scrollWidth - clientWidth;
        
        if (scrollLeft >= maxScroll - 10) {
          scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollRef.current.scrollTo({ left: scrollLeft + 170, behavior: 'smooth' });
        }
      }
    }, autoScrollInterval);

    return () => clearInterval(interval);
  }, [isPaused, products.length, autoScrollInterval]);

  const handleScroll = useCallback((dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 300;
    scrollRef.current.scrollTo({ 
      left: scrollRef.current.scrollLeft + (dir === 'left' ? -amount : amount), 
      behavior: 'smooth' 
    });
  }, []);

  if (products.length === 0) return null;

  return (
    <div 
      className="relative group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setTimeout(() => setIsPaused(false), 2000)}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3.5 rounded-t-2xl",
        `bg-gradient-to-r ${color}`
      )}>
        <div className="flex items-center gap-2.5">
          <span className="text-xl drop-shadow-md">{icon}</span>
          <h3 className="font-bold text-white text-base tracking-tight">{title}</h3>
          <span className="text-[10px] font-medium bg-white/25 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
            {products.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {products.length > 2 && (
            <>
              <button
                onClick={() => handleScroll('left')}
                className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-all"
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4 text-white" />
              </button>
              <button
                onClick={() => handleScroll('right')}
                className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-all"
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4 text-white" />
              </button>
            </>
          )}
          {viewAllLink && (
            <button
              onClick={() => navigate(viewAllLink)}
              className="flex items-center gap-1 text-white/90 hover:text-white text-xs font-semibold ml-1 transition-colors bg-white/15 px-3 py-1.5 rounded-full backdrop-blur-sm hover:bg-white/25"
            >
              All <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      
      {/* Products */}
      <div className="bg-card/80 backdrop-blur-sm rounded-b-2xl shadow-lg border border-border/50 p-3">
        <div 
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto scrollbar-hide scroll-smooth pb-1"
        >
          {products.map((product) => (
            <div key={product.id} className="w-[155px] shrink-0">
              <FloatingProductCard
                id={product.id}
                title={product.title}
                price={product.price}
                images={product.images}
                rentalUnit={product.rental_unit}
                isSponsored={product.sponsored}
                isAdminPosted={product.admin_posted}
                isNegotiable={product.is_negotiable}
                currencySymbol={product.currency_symbol}
                discount={product.discount}
                discountExpiry={product.discount_expiry}
                location={product.location}
                badgeLabel={badgeLabel}
                badgeTone={badgeTone}
                refSource={refSource}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AutoScrollCarousel;
