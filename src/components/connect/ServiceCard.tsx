import { useNavigate } from 'react-router-dom';
import { Play, MapPin, Star, ShieldCheck } from 'lucide-react';
import { optimizeCloudinaryUrl } from '@/lib/cloudinary';
import { Badge } from '@/components/ui/badge';
import type { Service } from '@/hooks/useServices';
import SaveButton from '@/components/social/SaveButton';

interface Props { service: Service; compact?: boolean }

const fmt = (n: number) => new Intl.NumberFormat().format(n);

const ServiceCard = ({ service, compact }: Props) => {
  const navigate = useNavigate();
  const cover = service.video_thumbnail || service.images?.[0] || '/placeholder.svg';
  const sym = service.currency_symbol || '';
  const priceLabel = service.pricing_type === 'negotiable'
    ? 'Negotiable'
    : service.pricing_type === 'starting_from'
      ? `From ${sym} ${fmt(Number(service.price || 0))}`
      : `${sym} ${fmt(Number(service.price || 0))}`;

  const goDetail = () => navigate(`/connect/service/${service.slug || service.id}`);

  return (
    <article
      onClick={goDetail}
      className="group cursor-pointer bg-card rounded-2xl overflow-hidden border border-border/40 hover:border-primary/40 hover:shadow-lg transition-all"
    >
      <div className="relative aspect-video bg-muted overflow-hidden">
        <img
          src={optimizeCloudinaryUrl(cover)}
          alt={service.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {service.video_url && (
          <div className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center">
            <Play className="h-4 w-4 text-white fill-white" />
          </div>
        )}
        {service.is_featured && (
          <Badge className="absolute top-2 left-12 bg-primary text-primary-foreground">Featured</Badge>
        )}
        <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
          <SaveButton itemType="service" itemId={service.id} className="bg-white/90 hover:bg-white shadow-sm" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
          <span className="inline-flex px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {priceLabel}
          </span>
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        <h3 className="font-semibold text-sm line-clamp-2 leading-tight">{service.title}</h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate flex-1">{service.seller?.full_name || 'Provider'}</span>
          {service.seller?.identity_verified && <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0" />}
        </div>
        {!compact && (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            {service.location && (
              <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3" />{service.location}</span>
            )}
            {Number(service.seller?.rating) > 0 && (
              <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{Number(service.seller?.rating).toFixed(1)}</span>
            )}
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); goDetail(); }}
          className="w-full mt-1 text-xs font-semibold text-primary hover:underline text-left"
        >
          View details →
        </button>
      </div>
    </article>
  );
};

export default ServiceCard;
