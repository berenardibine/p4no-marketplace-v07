import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Store, Briefcase } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const FollowingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [shops, setShops] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('follows')
        .select('target_type, target_id')
        .eq('follower_id', user.id);

      const shopIds = data?.filter(d => d.target_type === 'shop').map(d => d.target_id) || [];
      const providerIds = data?.filter(d => d.target_type === 'provider').map(d => d.target_id) || [];

      const [{ data: s }, { data: p }] = await Promise.all([
        shopIds.length ? supabase.from('shops').select('id, name, logo_url, slug').in('id', shopIds) : Promise.resolve({ data: [] }),
        providerIds.length ? supabase.from('profiles').select('id, full_name, profile_image').in('id', providerIds) : Promise.resolve({ data: [] }),
      ]);
      setShops(s || []);
      setProviders(p || []);
      setLoading(false);
    })();
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 text-center">
        <div>
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h2 className="font-bold text-lg">Sign in to see who you follow</h2>
          <button onClick={() => navigate('/auth')} className="mt-4 px-5 h-11 rounded-xl bg-primary text-primary-foreground font-semibold">Sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background safe-top">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-muted"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="font-bold text-lg">Following</h1>
      </header>
      <div className="px-4 py-4">
        <Tabs defaultValue="shops">
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="shops">Shops ({shops.length})</TabsTrigger>
            <TabsTrigger value="providers">Providers ({providers.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="shops" className="space-y-2">
            {loading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />) :
             shops.length === 0 ? <p className="text-center text-muted-foreground py-12">You don't follow any shops yet.</p> :
             shops.map(s => (
               <button key={s.id} onClick={() => navigate(`/shop/${s.slug || s.id}`)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40">
                 <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                   {s.logo_url ? <img src={s.logo_url} alt={s.name} className="w-full h-full object-cover" /> : <Store className="h-6 w-6 text-muted-foreground" />}
                 </div>
                 <span className="font-semibold flex-1 text-left truncate">{s.name}</span>
               </button>
             ))}
          </TabsContent>
          <TabsContent value="providers" className="space-y-2">
            {loading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />) :
             providers.length === 0 ? <p className="text-center text-muted-foreground py-12">You don't follow any providers yet.</p> :
             providers.map(p => (
               <button key={p.id} onClick={() => navigate(`/connect/provider/${p.id}`)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40">
                 <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                   {p.profile_image ? <img src={p.profile_image} alt={p.full_name} className="w-full h-full object-cover" /> : <Briefcase className="h-6 w-6 text-muted-foreground" />}
                 </div>
                 <span className="font-semibold flex-1 text-left truncate">{p.full_name}</span>
               </button>
             ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default FollowingPage;
