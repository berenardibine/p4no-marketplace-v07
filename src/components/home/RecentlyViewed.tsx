import { History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBrowsingHistory, HistoryItemType } from '@/hooks/useBrowsingHistory';

interface Props {
  itemType: HistoryItemType;
  excludeId?: string;
  title?: string;
}

const RecentlyViewed = ({ itemType, excludeId, title = 'Recently Viewed' }: Props) => {
  const { items, loading } = useBrowsingHistory(itemType, 12);
  const filtered = items.filter((i: any) => i.id !== excludeId).slice(0, 8);
  if (loading || filtered.length === 0) return null;

  const linkFor = (i: any) =>
    itemType === 'product' ? `/product/${i.slug || i.id}` :
    itemType === 'service' ? `/connect/service/${i.slug || i.id}` :
    `/insights/article/${i.slug || i.id}`;

  const imageOf = (i: any) =>
    i.images?.[0] || i.image_url || i.cover_image || i.thumbnail || '/placeholder.svg';

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
          <History className="h-4 w-4 text-muted-foreground" />
        </div>
        <h3 className="font-bold text-sm">{title}</h3>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
        {filtered.map((i: any) => (
          <Link key={i.id} to={linkFor(i)} className="shrink-0 w-32 snap-start">
            <div className="aspect-square rounded-xl overflow-hidden bg-muted">
              <img src={imageOf(i)} alt={i.title || i.name} className="w-full h-full object-cover" loading="lazy" />
            </div>
            <p className="text-xs font-medium mt-1.5 line-clamp-2">{i.title || i.name}</p>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default RecentlyViewed;