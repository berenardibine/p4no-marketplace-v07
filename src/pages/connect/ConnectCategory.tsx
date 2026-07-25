import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useServices } from '@/hooks/useServices';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import ServiceCard from '@/components/connect/ServiceCard';

const ConnectCategory = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { services, loading } = useServices({ category: slug, limit: 60 });
  const { categories } = useServiceCategories();
  const cat = categories.find(c => c.slug === slug);

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b">
        <div className="flex items-center gap-3 h-14 px-4">
          <button onClick={() => navigate('/connect')} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="font-semibold text-base">{cat?.icon} {cat?.name || slug}</h1>
        </div>
      </header>
      <div className="p-4">
        {loading ? <div className="text-center py-12 text-muted-foreground">Loading…</div>
          : services.length === 0 ? <div className="text-center py-12 text-muted-foreground">No services in this category yet</div>
          : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{services.map(s => <ServiceCard key={s.id} service={s} />)}</div>}
      </div>
    </div>
  );
};

export default ConnectCategory;
