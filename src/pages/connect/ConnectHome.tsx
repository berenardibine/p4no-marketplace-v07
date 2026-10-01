import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Briefcase, TrendingUp, Sparkles, Search, Plus, Megaphone } from 'lucide-react';
import { useServices } from '@/hooks/useServices';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { useAuth } from '@/hooks/useAuth';
import ServiceCard from '@/components/connect/ServiceCard';
import ServiceCarousel from '@/components/connect/ServiceCarousel';
import { Skeleton } from '@/components/ui/skeleton';
import PopularServicesThisWeek from '@/components/home/PopularServicesThisWeek';

const ConnectHome = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { services: featured, loading: l1 } = useServices({ featured: true, limit: 10 });
  const { services: trending, loading: l2 } = useServices({ trending: true, limit: 10 });
  const { services: recent, loading: l3 } = useServices({});
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return recent.slice(0, 12);
    return recent.filter(s => [s.title, s.short_description, s.category, s.location, s.seller?.full_name]
      .some(v => (v || '').toLowerCase().includes(t)));
  }, [recent, q]);
  const { categories } = useServiceCategories();

  const handleAddService = () => {
    if (!user) {
      navigate('/auth?redirect=/seller-dashboard?module=services');
      return;
    }
    if ((profile as any)?.user_type !== 'seller') {
      navigate('/auth?becomeSeller=1&redirect=/seller-dashboard?module=services');
      return;
    }
    navigate('/seller-dashboard?module=services');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 pb-12">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b">
        <div className="flex items-center gap-3 h-14 px-4">
          <button onClick={() => navigate('/')} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Briefcase className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-base">P4NO Connect</h1>
              <p className="text-[10px] text-muted-foreground">Trusted services & professionals</p>
            </div>
          </div>
          <button onClick={() => navigate('/connect/reels')} className="text-xs font-semibold text-primary px-3 py-1.5 rounded-full bg-primary/10">
            Reels
          </button>
        </div>
      </header>

      <main className="container px-4 py-4 space-y-6">
        {/* Add your service CTA */}
        <button
          onClick={handleAddService}
          className="w-full relative overflow-hidden rounded-2xl p-4 bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center gap-3 text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
            <Megaphone className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Add your service to reach more customers</p>
            <p className="text-[11px] opacity-90 mt-0.5">Publish on P4NO Connect in under 2 minutes</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Plus className="h-5 w-5" />
          </div>
        </button>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search services, providers, locations…" className="pl-9 rounded-xl" />
        </div>

        {/* Categories */}
        <section className="space-y-3">
          <h2 className="font-bold text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Popular Categories</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => navigate(`/connect/category/${c.slug}`)}
                className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-card border hover:border-primary/40 hover:shadow-md transition-all"
              >
                <span className="text-2xl">{c.icon || '✨'}</span>
                <span className="text-[11px] font-medium text-center line-clamp-2">{c.name}</span>
              </button>
            ))}
          </div>
        </section>

        <ServiceCarousel title="Featured Services" icon="⭐" services={featured} loading={l1} />
        <PopularServicesThisWeek />
        <ServiceCarousel title="Trending Providers" icon="🔥" services={trending} loading={l2} />

        <section className="space-y-3">
          <h2 className="font-bold text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> {q ? `Results (${shown.length})` : 'Recently Added'}</h2>
          {l3 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-video rounded-2xl" />)}
            </div>
          ) : shown.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border">
              <Briefcase className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{q ? 'No services match your search.' : 'No services yet. Be the first to publish!'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {shown.map(s => <ServiceCard key={s.id} service={s} />)}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default ConnectHome;
