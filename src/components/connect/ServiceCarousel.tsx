import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import ServiceCard from './ServiceCard';
import type { Service } from '@/hooks/useServices';

interface Props {
  title: string;
  icon?: string;
  services: Service[];
  viewAllLink?: string;
  loading?: boolean;
}

const ServiceCarousel = ({ title, icon, services, viewAllLink, loading }: Props) => {
  const navigate = useNavigate();
  if (!loading && services.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-base flex items-center gap-2">
          {icon && <span className="text-xl">{icon}</span>}
          {title}
        </h2>
        {viewAllLink && (
          <button onClick={() => navigate(viewAllLink)} className="text-xs font-semibold text-primary flex items-center gap-0.5">
            View all <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-1">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-40 shrink-0 snap-start">
                <div className="aspect-video bg-muted rounded-2xl animate-pulse" />
              </div>
            ))
          : services.map((s) => (
              <div key={s.id} className="w-56 shrink-0 snap-start">
                <ServiceCard service={s} compact />
              </div>
            ))}
      </div>
    </section>
  );
};

export default ServiceCarousel;
