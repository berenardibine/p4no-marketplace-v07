import { usePopularThisWeek } from '@/hooks/usePopularThisWeek';
import AutoScrollCarousel from './AutoScrollCarousel';

const PopularThisWeek = () => {
  const { items, loading } = usePopularThisWeek('product', 12);
  if (loading || !Array.isArray(items) || items.length === 0) return null;

  return (
    <section className="animate-fade-up">
      <AutoScrollCarousel
        title="Popular This Week"
        icon="🔥"
        color="from-rose-500 via-orange-500 to-amber-500"
        products={items as any}
        autoScrollInterval={3500}
        badgeLabel="TRENDING"
        badgeTone="trending"
        refSource="popular_week"
      />
    </section>
  );
};

export default PopularThisWeek;
