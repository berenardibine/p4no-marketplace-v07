import { Star, Sparkles } from 'lucide-react';
import FloatingProductCard from './FloatingProductCard';
import { useFeaturedProducts } from '@/hooks/useReferral';

interface FeaturedProductsProps {
  userCountry?: string | null;
}

const FeaturedProducts = ({ userCountry }: FeaturedProductsProps) => {
  const { featuredProducts, loading } = useFeaturedProducts(userCountry);

  if (loading || featuredProducts.length === 0) return null;

  return (
    <section className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex items-center justify-center shadow-md shadow-orange-500/25">
            <Star className="h-4.5 w-4.5 text-white fill-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">Featured Products</h3>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5" /> Promoted by referrals
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {featuredProducts.map((product: any) => (
          <FloatingProductCard
            key={product.id}
            id={product.id}
            slug={product.slug}
            title={product.title}
            price={product.price}
            images={product.images}
            rentalUnit={product.rental_unit}
            isSponsored={false}
            isNegotiable={product.is_negotiable}
            currencySymbol={product.currency_symbol}
            location={product.location}
            badgeLabel="FEATURED"
            badgeTone="best"
            refSource="featured"
          />
        ))}
      </div>
    </section>
  );
};

export default FeaturedProducts;
