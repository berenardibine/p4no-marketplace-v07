import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, MessageCircle, Share2, Play, Send, Loader2, Check, ShieldCheck, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { optimizeCloudinaryUrl } from '@/lib/cloudinary';
import { useRequestService } from '@/hooks/useRequestService';
import { sanitizePhone } from '@/lib/whatsappService';
import type { Service } from '@/hooks/useServices';
import { cn } from '@/lib/utils';
import { useFollow } from '@/hooks/useFollow';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import GuestPromptDialog from '@/components/auth/GuestPromptDialog';
import { logActivity } from '@/lib/activityEvents';

interface Props {
  service: Service;
  active: boolean;
  muted: boolean;
}

const fmt = (n: number) => new Intl.NumberFormat().format(n);

const ServiceReelItem = ({ service, active, muted }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { requestService, submitting } = useRequestService();
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const { isFollowing, loading: followLoading, toggle: toggleFollow } = useFollow('provider', service.seller_id || null);
  const { requireAuth, promptOpen, setPromptOpen } = useRequireAuth();

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) {
      v.currentTime = 0;
      v.play().then(() => setIsPlaying(true)).catch(() => setShowPlayIcon(true));
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }, [active]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setShowPlayIcon(false); setIsPlaying(true); }
    else { v.pause(); setShowPlayIcon(true); setIsPlaying(false); }
  };

  const detailPath = `/connect/service/${service.slug || service.id}`;
  const shareUrl = `${window.location.origin}${detailPath}`;

  const handleRequest = async () => {
    const ok = await requestService({
      service: {
        id: service.id,
        title: service.title,
        slug: service.slug,
        seller_id: service.seller_id,
        seller_whatsapp: service.whatsapp_number || service.seller?.whatsapp_number,
        seller_name: service.seller?.full_name,
      },
    });
    if (ok) {
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 1800);
    }
  };

  const handleCall = () => {
    const phone = service.phone_number || service.seller?.call_number;
    if (phone) window.open(`tel:${phone}`, '_self');
    else toast({ title: 'Phone not available', variant: 'destructive' });
  };

  const handleWhatsApp = () => {
    const raw = service.whatsapp_number || service.seller?.whatsapp_number;
    const phone = sanitizePhone(raw);
    if (phone) {
      const msg = encodeURIComponent(`Hi! I'm interested in your service: ${service.title} ${shareUrl}`);
      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    } else toast({ title: 'WhatsApp not available', variant: 'destructive' });
  };

  const handleShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title: service.title, url: shareUrl });
      else {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: 'Link copied! 🔗' });
      }
    } catch {}
  };

  const sym = service.currency_symbol || '';
  const priceLabel = service.pricing_type === 'negotiable'
    ? 'Negotiable'
    : service.pricing_type === 'starting_from'
      ? `From ${sym} ${fmt(Number(service.price || 0))}`
      : `${sym} ${fmt(Number(service.price || 0))}`;

  return (
    <section className="relative h-[100dvh] w-full snap-start snap-always bg-black overflow-hidden">
      {service.video_url ? (
        <video
          ref={videoRef}
          src={service.video_url}
          poster={optimizeCloudinaryUrl(service.images?.[0] || service.video_thumbnail || '')}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted={muted}
          loop
          preload={active ? 'auto' : 'metadata'}
          onClick={togglePlay}
        />
      ) : (
        <img
          src={optimizeCloudinaryUrl(service.images?.[0] || '/placeholder.svg')}
          alt={service.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {service.video_url && (showPlayIcon || !isPlaying) && active && (
        <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <Play className="h-10 w-10 text-white fill-white" />
          </div>
        </button>
      )}

      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />

      {/* Right floating actions */}
      <div className="absolute right-3 bottom-5 z-20 flex flex-col items-center gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={() => navigate(`/connect/provider/${service.seller_id}`)}
            className="relative"
            aria-label="Provider profile"
          >
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white bg-white/10 backdrop-blur-md flex items-center justify-center shadow-lg">
              {service.seller?.profile_image ? (
                <img src={optimizeCloudinaryUrl(service.seller.profile_image)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/80 flex items-center justify-center text-white font-bold text-lg">
                  {(service.seller?.full_name || 'P')[0]}
                </div>
              )}
            </div>
            {service.seller?.identity_verified && (
              <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                <ShieldCheck className="h-3 w-3 text-white" />
              </span>
            )}
          </button>
          {service.seller_id && (
            <button
              onClick={(e) => { e.stopPropagation(); requireAuth(() => toggleFollow()); }}
              className={cn(
                '-mt-3 px-3 py-0.5 rounded-full text-[11px] font-bold border-2 border-white shadow-md flex items-center gap-1 transition-all active:scale-95',
                isFollowing ? 'bg-white text-primary' : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
              aria-label={isFollowing ? 'Unfollow' : 'Follow'}
            >
              {followLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isFollowing ? (
                <><Check className="h-3 w-3" /> Following</>
              ) : (
                <>+ Follow</>
              )}
            </button>
          )}
        </div>

        <ActionBtn label={orderSuccess ? 'Sent!' : 'Request'} onClick={() => requireAuth(() => { logActivity({ event_type: 'service_click', entity_type: 'service', entity_id: service.id, metadata: { action: 'request' } }); handleRequest(); })} className="bg-primary text-primary-foreground">
          {orderSuccess ? <Check className="h-5 w-5" /> : submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </ActionBtn>
        <ActionBtn label="Comment" onClick={() => navigate(`${detailPath}#comments`)}>
          <MessageSquare className="h-5 w-5" />
        </ActionBtn>
        <ActionBtn label="Call" onClick={() => requireAuth(handleCall)} className="bg-orange-500/90 text-white">
          <Phone className="h-5 w-5" />
        </ActionBtn>
        <ActionBtn label="Chat" onClick={() => requireAuth(handleWhatsApp)} className="bg-emerald-500/90 text-white">
          <MessageCircle className="h-5 w-5" />
        </ActionBtn>
        <ActionBtn label="Share" onClick={handleShare}>
          <Share2 className="h-5 w-5" />
        </ActionBtn>
      </div>
      <GuestPromptDialog open={promptOpen} onOpenChange={setPromptOpen} title="Sign up to follow & interact" />

      {/* Bottom info */}
      <div className="absolute left-0 right-0 bottom-0 z-10 px-4 pt-6 pb-5 pr-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent text-white">
        <button
          onClick={() => navigate(`/connect/provider/${service.seller_id}`)}
          className="text-sm font-semibold mb-1 inline-flex items-center gap-1"
        >
          @{service.seller?.full_name || 'provider'}
        </button>
        <h3 className="text-base font-bold line-clamp-2">{service.title}</h3>
        {service.short_description && (
          <p className="text-xs opacity-90 line-clamp-2 mt-1">{service.short_description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-sm font-bold">
            {priceLabel}
          </span>
          <Button size="sm" variant="secondary" className="rounded-full h-8" onClick={() => navigate(detailPath)}>
            View details
          </Button>
        </div>
      </div>
    </section>
  );
};

const ActionBtn = ({
  children, label, onClick, className,
}: { children: React.ReactNode; label: string; onClick: () => void; className?: string }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
    <span className={cn('w-12 h-12 rounded-full bg-white/15 backdrop-blur-md text-white flex items-center justify-center shadow-lg', className)}>
      {children}
    </span>
    <span className="text-[10px] text-white drop-shadow font-medium">{label}</span>
  </button>
);

export default ServiceReelItem;
