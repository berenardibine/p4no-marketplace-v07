import { useEffect, useState } from 'react';
import { Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import FloatingProductCard from './FloatingProductCard';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  userCountry?: string | null;
}

const TodayBestDeals = ({ userCountry }: Props) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      setLoading(true);
      try {
        let q = supabase
          .from('products')
          .select('id, title, price, images, rental_unit, sponsored, admin_posted, is_negotiable, currency_symbol, discount, discount_expiry, slug, country, location')
          .eq('status', 'active')
          .gt('price', 0)
          .order('price', { ascending: true })
          .limit(12);
        if (userCountry) q = q.eq('country', userCountry);
        const { data } = await q;
        setProducts(data || []);
      } catch (e) {
        console.error('TodayBestDeals error', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDeals();
  }, [userCountry]);

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" />
          Today's Best Deals
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

  if (products.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" />
          Today's Best Deals
          <span className="text-xs text-muted-foreground font-normal">
            (cheapest {userCountry ? `in ${userCountry}` : 'worldwide'})
          </span>
        </h3>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {products.map((p) => (
          <div key={p.id} className="w-[180px] shrink-0">
            <FloatingProductCard
              id={p.id}
              slug={p.slug || undefined}
              title={p.title}
              price={p.price}
              images={p.images}
              rentalUnit={p.rental_unit}
              isSponsored={p.sponsored}
              isAdminPosted={p.admin_posted}
              isNegotiable={p.is_negotiable}
              currencySymbol={p.currency_symbol}
              discount={p.discount}
              discountExpiry={p.discount_expiry}
              location={p.location}
              badgeLabel="BEST DEAL"
              badgeTone="hot"
              refSource="best_deals"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TodayBestDeals;