import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getCachedReelDetail } from '@/lib/contentCache';
import ReelItem from '@/components/reels/ReelItem';
import PageMetaTags from '@/components/seo/PageMetaTags';
import VideoJsonLd from '@/components/seo/VideoJsonLd';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import type { Reel } from '@/hooks/useReels';

const SELECT = `
  id,title,description,price,currency_symbol,video_url,video_thumbnail,images,slug,
  seller_id,shop_id,contact_call,contact_whatsapp,minimum_quantity,unlimited_quantity,
  quantity,views,likes,admin_posted,admin_shop_name,created_at,updated_at,
  seller:profiles!products_seller_id_fkey(id, full_name, profile_image, whatsapp_number, call_number),
  shop:shops(id, name, logo_url, slug)
`;

const ReelDetail = () => {
  const { slugOrId } = useParams<{ slugOrId: string }>();
  const navigate = useNavigate();
  const [reel, setReel] = useState<(Reel & { created_at?: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!slugOrId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Static reel from Redis; views/likes/comments stay on DB elsewhere.
      const cached = await getCachedReelDetail(slugOrId);
      if (cached) {
        if (!cancelled) {
          setReel(cached as Reel);
          setLoading(false);
        }
        return;
      }
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
      const q = supabase.from('products').select(SELECT).not('video_url', 'is', null).neq('video_url', '');
      const { data } = await (isUuid ? q.eq('id', slugOrId) : q.eq('slug', slugOrId)).maybeSingle();
      if (cancelled) return;
      setReel((data as unknown as Reel) || null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slugOrId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-white animate-spin" />
      </div>
    );
  }

  if (!reel) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center gap-3">
        <h1 className="text-xl font-bold">Reel not found</h1>
        <p className="text-muted-foreground text-sm">This video may have been removed.</p>
        <button onClick={() => navigate('/reels')} className="mt-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm">
          Browse reels
        </button>
      </div>
    );
  }

  const canonicalPath = `/reels/${reel.slug || reel.id}`;
  const thumb = reel.video_thumbnail || reel.images?.[0] || '';
  const metaTitle = `${reel.title} – Video on P4NO`;
  const metaDesc = (reel.description || `Watch ${reel.title} on P4NO. Discover smarter shopping.`).slice(0, 160);

  return (
    <>
      <PageMetaTags
        title={metaTitle}
        description={metaDesc}
        image={thumb}
        url={canonicalPath}
        type="video.other"
      />
      <VideoJsonLd
        name={reel.title}
        description={reel.description || reel.title}
        thumbnailUrl={thumb}
        contentUrl={reel.video_url}
        uploadDate={(reel as any).created_at}
      />
      <Breadcrumbs
        items={[
          { name: 'Home', url: '/' },
          { name: 'Reels', url: '/reels' },
          { name: reel.title, url: canonicalPath },
        ]}
        id="breadcrumb-reel-jsonld"
      />
      <div className="fixed inset-0 bg-black z-40">
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center p-3 pointer-events-none">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center pointer-events-auto"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
        <ReelItem reel={reel} active muted={muted} onToggleMute={() => setMuted((m) => !m)} />
      </div>
      {/* Hidden semantic content for crawlers */}
      <div className="sr-only">
        <h1>{reel.title}</h1>
        <p>{reel.description}</p>
      </div>
    </>
  );
};

export default ReelDetail;