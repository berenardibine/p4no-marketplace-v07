import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useInsightArticles, type InsightArticle } from '@/hooks/useInsights';
import { useIsMobile } from '@/hooks/use-mobile';

const AUTOPLAY_MS = 4500;

const SlideCard = ({ a, big = false }: { a: InsightArticle; big?: boolean }) => (
  <Link
    to={`/insights/article/${a.slug}`}
    className="group relative block w-full overflow-hidden rounded-2xl bg-muted shadow-sm hover:shadow-xl transition-all"
  >
    <div className="relative w-full aspect-video overflow-hidden">
      {a.thumbnail_url ? (
        <img
          src={a.thumbnail_url}
          alt={a.title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-orange-500/30" />
      )}

    </div>
  </Link>
);

const InsightsHomeSlider = () => {
  const { data } = useInsightArticles({ limit: 10 });
  const articles = data?.rows || [];
  const isMobile = useIsMobile();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);

  // perPage: 1 mobile, 2 tablet, 3 desktop
  const [perPage, setPerPage] = useState(1);
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      setPerPage(w >= 1024 ? 3 : w >= 640 ? 2 : 1);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  const total = articles.length;
  const maxIndex = Math.max(0, total - perPage);

  useEffect(() => {
    if (total === 0 || paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i >= maxIndex ? 0 : i + 1));
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [total, maxIndex, paused]);

  useEffect(() => {
    if (index > maxIndex) setIndex(0);
  }, [maxIndex, index]);

  if (total === 0) return null;

  const go = (dir: 1 | -1) => {
    setIndex((i) => {
      const next = i + dir;
      if (next < 0) return maxIndex;
      if (next > maxIndex) return 0;
      return next;
    });
  };

  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchStart.current = null;
  };

  const translatePct = (100 / perPage) * index;

  return (
    <section className="animate-fade-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shadow-md shadow-primary/20">
            <Newspaper className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-foreground text-base">P4NO Insights</h2>
            <p className="text-[10px] text-muted-foreground">Stories, tips & ideas</p>
          </div>
        </div>
        <Link to="/insights" className="text-xs font-semibold text-primary flex items-center gap-1 hover:gap-1.5 transition-all">
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div
        className="relative group"
        onMouseEnter={() => !isMobile && setPaused(true)}
        onMouseLeave={() => !isMobile && setPaused(false)}
      >
        <div
          className="overflow-hidden rounded-2xl"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="flex transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${translatePct}%)` }}
          >
            {articles.map((a) => (
              <div
                key={a.id}
                className="shrink-0 px-1.5 first:pl-0 last:pr-0"
                style={{ width: `${100 / perPage}%` }}
              >
                <SlideCard a={a} big={perPage === 1} />
              </div>
            ))}
          </div>
        </div>

        {!isMobile && total > perPage && (
          <>
            <button
              type="button" aria-label="Previous"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/90 border border-border shadow opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-background"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button" aria-label="Next"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/90 border border-border shadow opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-background"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {total > perPage && (
          <div className="flex justify-center gap-1.5 mt-3">
            {Array.from({ length: maxIndex + 1 }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default InsightsHomeSlider;
