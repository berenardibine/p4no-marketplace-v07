import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getCachedCategory, getCachedList } from '@/lib/productCache';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin } from 'lucide-react';

interface Props { productId: string; category?: string | null }

interface Item {
  id: string;
  title: string;
  slug: string | null;
  price: number;
  images: string[];
  location: string | null;
  currency_symbol: string | null;
}

const RelatedProducts = ({ productId, category }: Props) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let rows: any[] | null = category
        ? await getCachedCategory(category, 0, 100)
        : await getCachedList('latest', 0, 100);
      if (!rows) {
        let q = supabase
          .from('products')
          .select('id,title,slug,price,images,location,currency_symbol')
          .neq('id', productId)
          .eq('status', 'active')
          .limit(10);
        if (category) q = q.eq('category', category);
        const { data } = await q;
        rows = data ?? [];
      }
      if (cancelled) return;
      setItems(((rows || []) as Item[]).filter((p) => p.id !== productId).slice(0, 10));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [productId, category]);

  if (!loading && items.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold mb-4">You may also like</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {loading
          ? Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
            ))
          : items.map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.slug || p.id}`}
                className="group bg-card rounded-2xl overflow-hidden border border-border/40 hover:border-primary/40 hover:shadow-lg transition-all"
              >
                <div className="aspect-[4/5] bg-muted overflow-hidden">
                  <img
                    src={p.images?.[0] || '/placeholder.svg'}
                    alt={p.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
                  />
                </div>
                <div className="p-2.5">
                  <h3 className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{p.title}</h3>
                  <p className="text-primary font-bold text-sm mt-1">
                    {p.currency_symbol || 'Fr'} {Number(p.price).toLocaleString()}
                  </p>
                  {p.location && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />{p.location}
                    </p>
                  )}
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
};

export default RelatedProducts;
