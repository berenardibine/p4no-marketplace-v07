import { useState, useEffect, useCallback, useRef } from 'react';
import { getRecommendations } from '@/lib/recommendations';
import FloatingProductCard from '@/components/home/FloatingProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles } from 'lucide-react';

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  category: string | null;
  rental_unit: string | null;
  sponsored: boolean | null;
  is_negotiable: boolean | null;
}

interface AIRecommendationsProps {
  productId: string;
}

const AIRecommendations = ({ productId }: AIRecommendationsProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const loaderRef = useRef<HTMLDivElement>(null);

  const fetchRecommendations = useCallback(async (pageNum: number, append = false) => {
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      // Cached + coalesced: repeat mounts and concurrent callers for the same
      // product share one Edge Function request.
      const result = await getRecommendations(productId, pageNum, 12);

      if (result.products) {
        if (append) {
          setProducts(prev => [...prev, ...result.products]);
        } else {
          setProducts(result.products);
        }
        setHasMore(result.hasMore);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [productId]);

  useEffect(() => {
    setPage(0);
    setProducts([]);
    fetchRecommendations(0);
  }, [productId, fetchRecommendations]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchRecommendations(nextPage, true);
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, page, fetchRecommendations]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          You May Also Like
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        You May Also Like
      </h3>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {products.map((product: any) => (
          <FloatingProductCard
            key={product.id}
            id={product.id}
            title={product.title}
            price={product.price}
            images={product.images}
            rentalUnit={product.rental_unit}
            isSponsored={product.sponsored}
            isNegotiable={product.is_negotiable}
            location={product.location}
            badgeLabel="FOR YOU"
            badgeTone="best"
            refSource="ai_recommendations"
          />
        ))}
      </div>

      {/* Infinite scroll loader */}
      {hasMore && (
        <div ref={loaderRef} className="flex justify-center py-4">
          {loadingMore && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading more...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIRecommendations;
