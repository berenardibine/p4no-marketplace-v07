import { useBoostedProducts } from '@/hooks/useBoostedProducts';
import FloatingProductCard from '@/components/home/FloatingProductCard';
import { Rocket } from 'lucide-react';

const BoostedProductsSection = () => {
  const { boosts, loading } = useBoostedProducts();

  if (loading || boosts.length === 0) return null;

  return (
    <section className="animate-fade-up">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-md">
          <Rocket className="h-4 w-4 text-white" />
        </div>
        <h2 className="font-bold text-base">🔥 Boosted Products</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {boosts.slice(0, 8).map((boost: any) => (
          <FloatingProductCard
            key={boost.id}
            id={boost.product?.id}
            title={boost.product?.title}
            price={boost.product?.price}
            images={boost.product?.images}
            rentalUnit={boost.product?.rental_unit}
            isSponsored={true}
            isNegotiable={boost.product?.is_negotiable}
            location={boost.product?.location}
            badgeLabel="BOOSTED"
            badgeTone="hot"
            refSource="boosted"
          />
        ))}
      </div>
    </section>
  );
};

export default BoostedProductsSection;
