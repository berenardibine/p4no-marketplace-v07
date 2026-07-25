import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getCachedServices } from '@/lib/contentCache';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin } from 'lucide-react';

interface Props { serviceId: string; category?: string | null }

interface Item {
  id: string;
  title: string;
  slug: string | null;
  price: number | null;
  pricing_type: string;
  images: string[];
  video_thumbnail: string | null;
  location: string | null;
  currency_symbol: string | null;
}

const RelatedServices = ({ serviceId, category }: Props) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let rows: any[] | null = category
        ? await getCachedServices('category', category, 0, 100)
        : await getCachedServices('latest', undefined, 0, 100);
      if (!rows) {
        let q = supabase
          .from('services')
          .select('id,title,slug,price,pricing_type,images,video_thumbnail,location,currency_symbol')
          .neq('id', serviceId)
          .eq('status', 'active')
          .limit(10);
        if (category) q = q.eq('category', category);
        const { data } = await q;
        rows = data ?? [];
      }
      if (cancelled) return;
      setItems(((rows || []) as Item[]).filter((s) => s.id !== serviceId).slice(0, 10));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [serviceId, category]);

  if (!loading && items.length === 0) return null;

  const priceOf = (s: Item) => s.pricing_type === 'negotiable'
    ? 'Negotiable'
    : s.pricing_type === 'starting_from'
      ? `From ${s.currency_symbol || ''} ${Number(s.price || 0).toLocaleString()}`
      : `${s.currency_symbol || ''} ${Number(s.price || 0).toLocaleString()}`;

  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold mb-4">More services like this</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {loading
          ? Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
            ))
          : items.map((s) => (
              <Link
                key={s.id}
                to={`/connect/service/${s.slug || s.id}`}
                className="group bg-card rounded-2xl overflow-hidden border border-border/40 hover:border-primary/40 hover:shadow-lg transition-all"
              >
                <div className="aspect-[4/5] bg-muted overflow-hidden">
                  <img
                    src={s.video_thumbnail || s.images?.[0] || '/placeholder.svg'}
                    alt={s.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
                  />
                </div>
                <div className="p-2.5">
                  <h3 className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{s.title}</h3>
                  <p className="text-primary font-bold text-sm mt-1">{priceOf(s)}</p>
                  {s.location && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />{s.location}
                    </p>
                  )}
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
};

export default RelatedServices;
