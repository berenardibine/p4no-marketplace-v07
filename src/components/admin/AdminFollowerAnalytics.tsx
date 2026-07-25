import { useEffect, useState } from 'react';
import { Users, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface TopRow {
  target_id: string;
  count: number;
  name: string;
  avatar?: string | null;
}

const AdminFollowerAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [totalFollows, setTotalFollows] = useState(0);
  const [topShops, setTopShops] = useState<TopRow[]>([]);
  const [topProviders, setTopProviders] = useState<TopRow[]>([]);
  const [topCategories, setTopCategories] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: follows } = await supabase
          .from('follows')
          .select('target_type, target_id');

        const list = follows || [];
        setTotalFollows(list.length);

        const tally = (type: string) => {
          const m = new Map<string, number>();
          list.filter(f => f.target_type === type).forEach(f => m.set(f.target_id, (m.get(f.target_id) || 0) + 1));
          return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
        };

        const shopTop = tally('shop');
        const providerTop = tally('provider');

        if (shopTop.length) {
          const { data: shops } = await supabase
            .from('shops')
            .select('id, name, logo_url')
            .in('id', shopTop.map(([id]) => id));
          const map = new Map((shops || []).map((s: any) => [s.id, s]));
          setTopShops(shopTop.map(([id, count]) => ({
            target_id: id,
            count,
            name: map.get(id)?.name || 'Unknown shop',
            avatar: map.get(id)?.logo_url,
          })));
        }

        if (providerTop.length) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, profile_image, category')
            .in('id', providerTop.map(([id]) => id));
          const map = new Map((profiles || []).map((p: any) => [p.id, p]));
          setTopProviders(providerTop.map(([id, count]) => ({
            target_id: id,
            count,
            name: map.get(id)?.full_name || 'Unknown',
            avatar: map.get(id)?.profile_image,
          })));

          // Categories from provider profiles
          const catCounts = new Map<string, number>();
          providerTop.forEach(([id, count]) => {
            const c = (map.get(id) as any)?.category;
            if (c) catCounts.set(c, (catCounts.get(c) || 0) + count);
          });
          setTopCategories(Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })));
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Followers</p>
            <p className="text-2xl font-bold">{totalFollows.toLocaleString()}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Top Followed Shops</h3>
          </div>
          {topShops.length === 0 ? (
            <p className="text-sm text-muted-foreground">No followed shops yet</p>
          ) : (
            <ul className="space-y-2">
              {topShops.map((s, i) => (
                <li key={s.target_id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{i + 1}. {s.name}</span>
                  <span className="font-semibold text-primary">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Top Followed Providers</h3>
          </div>
          {topProviders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No followed providers yet</p>
          ) : (
            <ul className="space-y-2">
              {topProviders.map((p, i) => (
                <li key={p.target_id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{i + 1}. {p.name}</span>
                  <span className="font-semibold text-primary">{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {topCategories.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Top Categories by Provider Follows</h3>
          <ul className="space-y-2">
            {topCategories.map((c) => (
              <li key={c.name} className="flex items-center justify-between text-sm">
                <span className="capitalize">{c.name}</span>
                <span className="font-semibold text-primary">{c.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};

export default AdminFollowerAnalytics;
