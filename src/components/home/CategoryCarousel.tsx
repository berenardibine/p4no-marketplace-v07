import { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FloatingProductCard from './FloatingProductCard';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  rental_unit?: string | null;
  sponsored?: boolean | null;
  admin_posted?: boolean | null;
  currency_symbol?: string | null;
}

interface CategoryCarouselProps {
  categoryName: string;
  categorySlug: string;
  categoryIcon: string;
  categoryColor: string;
  products: Product[];
  autoScrollInterval?: number;
}

const CategoryCarousel = ({
  categoryName,
  categorySlug,
  categoryIcon,
  categoryColor,
  products,
  autoScrollInterval = 4000,
}: CategoryCarouselProps) => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (products.length <= 2 || isPaused) return;

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
  }, [products.length, isPaused, autoScrollInterval]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 300;
    scrollRef.current.scrollTo({ 
      left: scrollRef.current.scrollLeft + (direction === 'left' ? -amount : amount), 
      behavior: 'smooth' 
    });
  };

  if (products.length === 0) return null;

  return (
    <div 
      className="animate-fade-up"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setTimeout(() => setIsPaused(false), 2000)}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3.5 rounded-t-2xl",
        `bg-gradient-to-r ${categoryColor}`
      )}>
        <div className="flex items-center gap-2.5">
          <span className="text-xl drop-shadow-md">{categoryIcon}</span>
          <h3 className="font-bold text-white text-base tracking-tight">{categoryName}</h3>
          <span className="text-[10px] font-medium bg-white/25 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
            {products.length}
          </span>
        </div>
        <button
          onClick={() => navigate(`/category/${categorySlug}`)}
          className="flex items-center gap-1 text-white/90 hover:text-white text-xs font-semibold bg-white/15 px-3 py-1.5 rounded-full backdrop-blur-sm hover:bg-white/25 transition-all"
        >
          View All <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* Carousel */}
      <div className="relative bg-card/80 backdrop-blur-sm rounded-b-2xl shadow-lg border border-border/50 p-3">
        {products.length > 2 && (
          <>
            <button
              onClick={() => handleScroll('left')}
              className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/90 shadow-md flex items-center justify-center hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleScroll('right')}
              className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/90 shadow-md flex items-center justify-center hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto scrollbar-hide scroll-smooth px-1"
        >
          {products.map((product) => (
            <div key={product.id} className="w-[155px] shrink-0">
              <FloatingProductCard
                id={product.id}
                title={product.title}
                price={product.price}
                images={product.images}
                rentalUnit={product.rental_unit}
                isSponsored={product.admin_posted ? false : product.sponsored}
                hideSponsored={product.admin_posted}
                currencySymbol={product.currency_symbol}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CategoryCarousel;
