import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, ChevronRight } from 'lucide-react';
import { useServices } from '@/hooks/useServices';
import ServiceCard from '@/components/connect/ServiceCard';
import { Skeleton } from '@/components/ui/skeleton';

const AUTOPLAY_MS = 4500;

const ServicesSection = () => {
  const navigate = useNavigate();
  const { services, loading } = useServices({ limit: 8, featured: false });
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);

  const total = services.length;

  useEffect(() => {
    if (total === 0 || paused) return;
    const id = setInterval(() => setIndex(i => (i + 1) % total), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [total, paused]);

  if (!loading && total === 0) return null;

  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current == null || total === 0) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 40) setIndex(i => (i + (dx < 0 ? 1 : -1) + total) % total);
    touchStart.current = null;
  };

  return (
    <section className="space-y-3 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20">
            <Briefcase className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-base">P4NO Connect • Services</h2>
            <p className="text-[10px] text-muted-foreground">Trusted providers near you</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/connect')}
          className="text-xs font-semibold text-primary flex items-center gap-0.5"
        >
          View all <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      {loading ? (
        <Skeleton className="aspect-video rounded-2xl" />
      ) : (
        <div
          className="overflow-hidden rounded-2xl"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            className="flex transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {services.map((s) => (
              <div key={s.id} className="w-full shrink-0">
                <ServiceCard service={s} />
              </div>
            ))}
          </div>
        </div>
      )}
      {total > 1 && (
        <div className="flex justify-center gap-1.5">
          {services.map((_, i) => (
            <button
              key={i}
              aria-label={`Slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default ServicesSection;
