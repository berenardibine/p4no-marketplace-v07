import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Loader2, Sparkles, Flame, Clock } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useReels, type ReelMode } from '@/hooks/useReels';
import ReelItem from '@/components/reels/ReelItem';
import { cn } from '@/lib/utils';
import PageMetaTags from '@/components/seo/PageMetaTags';

const MODES: { id: ReelMode; label: string; icon: React.ReactNode }[] = [
  { id: 'foryou', label: 'For You', icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: 'trending', label: 'Trending', icon: <Flame className="h-3.5 w-3.5" /> },
  { id: 'latest', label: 'Latest', icon: <Clock className="h-3.5 w-3.5" /> },
];

const ReelsPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const startId = params.get('start');
  const [mode, setMode] = useState<ReelMode>('foryou');
  const { reels, loading, hasMore, loadMore } = useReels(mode, startId);
  const [activeIdx, setActiveIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Emit ItemList JSON-LD for the visible reels (helps Google understand the feed)
  useEffect(() => {
    if (!reels.length) return;
    const id = 'reels-itemlist-jsonld';
    const data = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: reels.slice(0, 20).map((r, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${window.location.origin}/reels/${r.slug || r.id}`,
        name: r.title,
      })),
    };
    let s = document.getElementById(id) as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement('script');
      s.id = id;
      s.type = 'application/ld+json';
      document.head.appendChild(s);
    }
    s.textContent = JSON.stringify(data);
    return () => { document.getElementById(id)?.remove(); };
  }, [reels]);

  // Track which reel is in view
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const i = Number((e.target as HTMLElement).dataset.idx);
            setActiveIdx(i);
            // Trigger loadMore when near end
            if (i >= reels.length - 3 && hasMore && !loading) loadMore();
          }
        });
      },
      { threshold: [0, 0.6, 1] }
    );
    itemRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [reels.length, hasMore, loading, loadMore]);

  const setRef = useCallback((el: HTMLDivElement | null, i: number) => {
    itemRefs.current[i] = el;
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-40">
      <PageMetaTags
        title="Reels – Shop products through short videos | P4NO"
        description="Discover trending products through short videos. Watch reels from sellers worldwide and order instantly on P4NO."
        url="/reels"
        type="website"
      />
      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-3 pointer-events-none">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center pointer-events-auto"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex gap-1 bg-black/40 backdrop-blur-md rounded-full p-1 pointer-events-auto">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                'flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full transition-all',
                mode === m.id ? 'bg-white text-black' : 'text-white/80'
              )}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
        <div className="w-10" />
      </div>

      {/* Snap container */}
      <div
        ref={containerRef}
        className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory overscroll-contain"
        style={{ scrollbarWidth: 'none' }}
      >
        {reels.length === 0 && !loading && (
          <div className="h-[100dvh] flex flex-col items-center justify-center text-white text-center p-8">
            <Sparkles className="h-12 w-12 mb-3 opacity-60" />
            <h2 className="text-xl font-bold mb-2">No reels yet</h2>
            <p className="text-white/70 text-sm">Sellers haven't uploaded videos here. Check back soon!</p>
          </div>
        )}

        {reels.map((r, i) => (
          <div key={`${r.id}-${i}`} data-idx={i} ref={(el) => setRef(el, i)}>
            <ReelItem
              reel={r}
              active={i === activeIdx}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
            />
          </div>
        ))}

        {loading && (
          <div className="h-32 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ReelsPage;
