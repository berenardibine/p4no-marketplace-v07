import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Sparkles, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getCachedReels } from '@/lib/contentCache';
import { optimizeCloudinaryUrl } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';

interface ReelTeaser {
  id: string;
  slug: string | null;
  title: string;
  video_url: string;
  video_thumbnail: string | null;
  images: string[] | null;
  price: number;
  currency_symbol: string | null;
}

const HomeReels = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<ReelTeaser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cachedRaw = await getCachedReels('latest', 0, 100);
      let rows: any[] = Array.isArray(cachedRaw) ? cachedRaw : [];
      if (rows.length === 0) {
        const { data } = await supabase
          .from('products')
          .select('id,slug,title,video_url,video_thumbnail,images,price,currency_symbol')
          .not('video_url', 'is', null)
          .neq('video_url', '')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(3);
        rows = Array.isArray(data) ? data : [];
      }
      if (!cancelled) {
        setItems(rows.slice(0, 3) as any);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading || items.length === 0) return null;

  const open = (id: string) => navigate(`/reels?start=${id}`);

  return (
    <section className="animate-fade-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 flex items-center justify-center shadow-md">
            <Play className="h-4 w-4 text-white fill-white" />
          </div>
          <div>
            <h2 className="font-bold text-foreground text-base flex items-center gap-1">
              Reels <Sparkles className="h-3.5 w-3.5 text-pink-500" />
            </h2>
            <p className="text-[10px] text-muted-foreground">Watch & shop products</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/reels')}
          className="text-xs font-semibold text-primary inline-flex items-center gap-0.5"
        >
          See all <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 snap-x snap-mandatory">
        {items.map((it) => {
          const poster = it.images?.[0] || it.video_thumbnail || '';
          return (
            <button
              key={it.id}
              onClick={() => open(it.id)}
              className={cn(
                'relative shrink-0 snap-start w-[126px] h-[224px] rounded-2xl overflow-hidden',
                'bg-black shadow-lg active:scale-95 transition-transform'
              )}
            >
              {poster ? (
                <img
                  src={optimizeCloudinaryUrl(poster)}
                  alt={it.title}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <video
                  src={it.video_url}
                  muted
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-pink-500/90 text-white text-[9px] font-bold flex items-center gap-0.5">
                <Play className="h-2.5 w-2.5 fill-white" /> REEL
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-white/25 backdrop-blur-md flex items-center justify-center">
                  <Play className="h-5 w-5 text-white fill-white" />
                </div>
              </div>
              <div className="absolute bottom-1.5 left-1.5 right-1.5 text-white">
                <p className="text-[11px] font-semibold line-clamp-2 leading-tight drop-shadow">
                  {it.title}
                </p>
                {it.price > 0 && (
                  <p className="text-[10px] font-bold mt-0.5 text-pink-300 drop-shadow">
                    {it.currency_symbol || ''} {new Intl.NumberFormat().format(it.price)}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default HomeReels;
