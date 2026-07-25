import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useServices } from '@/hooks/useServices';
import ServiceReelItem from '@/components/connect/ServiceReelItem';

const ConnectReels = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startId = searchParams.get('start');
  const { services, loading } = useServices({ limit: 30 });
  const reels = services.filter(s => s.video_url);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const didJumpRef = useRef(false);

  // Jump to the requested reel once data is ready
  useEffect(() => {
    if (didJumpRef.current || !startId || reels.length === 0) return;
    const idx = reels.findIndex(r => r.id === startId);
    if (idx < 0) return;
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'auto', block: 'start' });
      setActive(idx);
      didJumpRef.current = true;
    }
  }, [startId, reels]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const idx = parseInt((e.target as HTMLElement).dataset.idx || '0');
          setActive(idx);
        }
      });
    }, { root: el, threshold: 0.6 });
    el.querySelectorAll('[data-reel]').forEach(n => obs.observe(n));
    return () => obs.disconnect();
  }, [reels.length]);

  return (
    <div className="fixed inset-0 bg-black">
      <button onClick={() => navigate(-1)} className="absolute top-4 left-4 z-50 w-10 h-10 rounded-full bg-black/50 backdrop-blur text-white flex items-center justify-center">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div ref={containerRef} className="h-full overflow-y-scroll snap-y snap-mandatory">
        {loading ? (
          <div className="h-full flex items-center justify-center text-white">Loading…</div>
        ) : reels.length === 0 ? (
          <div className="h-full flex items-center justify-center text-white">No service reels yet</div>
        ) : (
          reels.map((s, i) => (
            <div key={s.id} data-reel data-idx={i}>
              <ServiceReelItem service={s} active={i === active} muted={false} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConnectReels;
