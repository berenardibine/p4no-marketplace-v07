import { TrendingUp } from 'lucide-react';
import { usePopularThisWeek } from '@/hooks/usePopularThisWeek';
import ArticleCard from './ArticleCard';

const PopularArticlesThisWeek = () => {
  const { items, loading } = usePopularThisWeek('article', 6);
  if (loading || items.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 flex items-center justify-center shadow-md">
          <TrendingUp className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-base">Popular This Week</h2>
          <p className="text-[10px] text-muted-foreground">Most read articles</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((a: any) => <ArticleCard key={a.id} article={a} />)}
      </div>
    </section>
  );
};
export default PopularArticlesThisWeek;