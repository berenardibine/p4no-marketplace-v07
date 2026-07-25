import { useEffect, useRef, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { usePopularThisWeek } from '@/hooks/usePopularThisWeek';
import ServiceCard from '@/components/connect/ServiceCard';

const PopularServicesThisWeek = () => {
  const { items, loading } = usePopularThisWeek('service', 8);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    const id = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      if (scrollLeft + clientWidth >= scrollWidth - 10) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: 240, behavior: 'smooth' });
      }
    }, 3500);
    return () => clearInterval(id);
  }, [items.length, paused]);

  if (loading || items.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 flex items-center justify-center shadow-md">
          <TrendingUp className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-base">Popular This Week</h2>
          <p className="text-[10px] text-muted-foreground">Most viewed services</p>
        </div>
      </div>
      <div
        ref={scrollRef}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setTimeout(() => setPaused(false), 2000)}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-1 scroll-smooth"
      >
        {items.map((s: any) => (
          <div key={s.id} className="w-60 shrink-0 snap-start">
            <ServiceCard service={s} />
          </div>
        ))}
      </div>
    </section>
  );
};
export default PopularServicesThisWeek;