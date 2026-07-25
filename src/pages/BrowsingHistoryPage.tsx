import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, History, Trash2, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useBrowsingHistory, HistoryItemType } from '@/hooks/useBrowsingHistory';
import { useAuth } from '@/hooks/useAuth';

const TYPES: { value: HistoryItemType; label: string }[] = [
  { value: 'product', label: 'Products' },
  { value: 'service', label: 'Services' },
  { value: 'article', label: 'Articles' },
];

function HistoryList({ itemType }: { itemType: HistoryItemType }) {
  const { items, loading, remove, clearAll } = useBrowsingHistory(itemType, 50);
  if (loading) return <p className="text-sm text-muted-foreground text-center py-12">Loading…</p>;
  if (items.length === 0) return <p className="text-sm text-muted-foreground text-center py-12">No history yet.</p>;
  const linkFor = (i: any) =>
    itemType === 'product' ? `/product/${i.slug || i.id}` :
    itemType === 'service' ? `/connect/service/${i.slug || i.id}` :
    `/insights/article/${i.slug || i.id}`;
  const imageOf = (i: any) => i.images?.[0] || i.image_url || i.cover_image || i.thumbnail || '/placeholder.svg';

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={clearAll} className="text-destructive">
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear all
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((i: any) => (
          <div key={i.id} className="relative bg-card rounded-2xl border overflow-hidden group">
            <button onClick={() => remove(i.id)} className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-background/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <X className="h-3 w-3" />
            </button>
            <Link to={linkFor(i)}>
              <div className="aspect-square bg-muted"><img src={imageOf(i)} alt={i.title || i.name} className="w-full h-full object-cover" loading="lazy" /></div>
              <div className="p-2"><p className="text-xs font-medium line-clamp-2">{i.title || i.name}</p></div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

const BrowsingHistoryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<HistoryItemType>('product');

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <History className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">Sign in to view your browsing history.</p>
          <Button onClick={() => navigate('/auth')}>Sign in</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b">
        <div className="flex items-center gap-3 h-14 px-4">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="font-bold text-base">Browsing History</h1>
        </div>
      </header>
      <main className="container px-4 py-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as HistoryItemType)}>
          <TabsList className="grid grid-cols-3 w-full">
            {TYPES.map(t => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
          </TabsList>
          {TYPES.map(t => (
            <TabsContent key={t.value} value={t.value} className="mt-4">
              <HistoryList itemType={t.value} />
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
};

export default BrowsingHistoryPage;