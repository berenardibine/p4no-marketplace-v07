import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Phone, MessageCircle, Share2, Play, Store, ShoppingBag, Check, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { optimizeCloudinaryUrl } from '@/lib/cloudinary';
import type { Reel } from '@/hooks/useReels';
import { cn } from '@/lib/utils';
import { useFollow } from '@/hooks/useFollow';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import GuestPromptDialog from '@/components/auth/GuestPromptDialog';
import CommentsSheet from '@/components/comments/CommentsSheet';
import { logActivity } from '@/lib/activityEvents';

interface ReelItemProps {
  reel: Reel;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
}

const formatPrice = (n: number, sym?: string | null) =>
  `${sym || ''} ${new Intl.NumberFormat().format(n)}`.trim();

const ReelItem = ({ reel, active, muted, onToggleMute }: ReelItemProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const cart = useCart();
  const { toast } = useToast();
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const { isFollowing, count: followerCount, loading: followLoading, toggle: toggleFollow } = useFollow('shop', reel.shop?.id || null);
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
    if (v.paused) {
      v.play();
      setShowPlayIcon(false);
      setIsPlaying(true);
    } else {
      v.pause();
      setShowPlayIcon(true);
      setIsPlaying(false);
    }
  };

  const productPath = `/product/${reel.slug || reel.id}`;
  const reelPath = `/reels/${reel.slug || reel.id}`;
  const shareUrl = `${window.location.origin}${reelPath}`;

  const addToCart = (goCheckout = false) => {
    const ok = cart.addItem({
      id: reel.id,
      title: reel.title,
      price: reel.price,
      image: reel.images?.[0] || reel.video_thumbnail || '',
      maxQuantity: reel.quantity || 999,
      minQuantity: reel.minimum_quantity || 1,
      unlimitedQuantity: reel.unlimited_quantity || false,
      sellerId: reel.seller_id,
      sellerName: reel.shop?.name || reel.seller?.full_name || 'Seller',
      currencySymbol: reel.currency_symbol || undefined,
    });
    if (ok && goCheckout) navigate('/checkout');
  };

  const handleOrderNow = () => {
    // Same flow as Mark: add to cart with min/quantity, then floating bar takes user to checkout.
    const ok = cart.addItem({
      id: reel.id,
      title: reel.title,
      price: reel.price,
      image: reel.images?.[0] || reel.video_thumbnail || '',
      maxQuantity: reel.quantity || 999,
      minQuantity: reel.minimum_quantity || 1,
      unlimitedQuantity: reel.unlimited_quantity || false,
      sellerId: reel.seller_id,
      sellerName: reel.shop?.name || reel.seller?.full_name || 'Seller',
      currencySymbol: reel.currency_symbol || undefined,
    });
    if (ok) {
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 1200);
      navigate('/checkout');
    }
  };

  const handleCall = () => {
    const phone = reel.contact_call || reel.seller?.call_number;
    if (phone) window.open(`tel:${phone}`, '_self');
    else toast({ title: 'Phone not available', variant: 'destructive' });
  };

  const handleWhatsApp = () => {
    const phone = reel.contact_whatsapp || reel.seller?.whatsapp_number;
    if (phone) {
      const msg = encodeURIComponent(`Hi! I'm interested in: ${reel.title} ${shareUrl}`);
      window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
    } else toast({ title: 'WhatsApp not available', variant: 'destructive' });
  };

  const handleShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title: reel.title, url: shareUrl });
      else {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: 'Link copied! 🔗' });
      }
    } catch {}
  };

  const goShop = () => {
    if (reel.shop?.id) navigate(`/shop/${reel.shop.id}`);
  };

  return (
    <section
      className="relative h-[100dvh] w-full snap-start snap-always bg-black overflow-hidden"
      aria-label={reel.title}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={reel.video_url}
        poster={optimizeCloudinaryUrl(reel.images?.[0] || reel.video_thumbnail || '')}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted={muted}
        loop
        preload={active ? 'auto' : 'metadata'}
        onClick={togglePlay}
      />

      {/* Tap-to-play indicator */}
      {(showPlayIcon || !isPlaying) && active && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-10"
          aria-label="Play"
        >
          <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <Play className="h-10 w-10 text-white fill-white" />
          </div>
        </button>
      )}

      {/* Top gradient */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />

      {/* Right floating actions — anchored 20px from bottom */}
      <div className="absolute right-3 bottom-5 z-20 flex flex-col items-center gap-3">
        {/* Shop / virtual avatar with prominent Follow chip */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={reel.admin_posted ? undefined : goShop}
            className="relative"
            aria-label={reel.admin_posted ? (reel.admin_shop_name || 'Official') : 'Visit shop'}
          >
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white bg-white/10 backdrop-blur-md flex items-center justify-center shadow-lg">
              {reel.admin_posted ? (
                <Store className="h-7 w-7 text-white" />
              ) : reel.shop?.logo_url || reel.seller?.profile_image ? (
                <img
                  src={optimizeCloudinaryUrl(reel.shop?.logo_url || reel.seller?.profile_image || '')}
                  alt={reel.shop?.name || ''}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-primary/80 flex items-center justify-center text-white font-bold text-lg">
                  {(reel.shop?.name || reel.seller?.full_name || 'S')[0]}
                </div>
              )}
            </div>
          </button>
          {!reel.admin_posted && reel.shop?.id && (
            <button
              onClick={(e) => { e.stopPropagation(); requireAuth(() => toggleFollow()); }}
              className={cn(
                '-mt-3 px-3 py-0.5 rounded-full text-[11px] font-bold border-2 border-white shadow-md flex items-center gap-1 transition-all active:scale-95',
                isFollowing
                  ? 'bg-white text-primary'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
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

        <ActionBtn
          label={orderSuccess ? 'Sent!' : 'Order'}
          onClick={() => requireAuth(() => { logActivity({ event_type: 'product_click', entity_type: 'product', entity_id: reel.id, metadata: { action: 'order' } }); handleOrderNow(); })}
          className="bg-primary text-primary-foreground"
        >
          {orderSuccess ? <Check className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
        </ActionBtn>
        <ActionBtn label="Comment" onClick={() => requireAuth(() => setCommentsOpen(true))}>
          <MessageSquare className="h-5 w-5" />
        </ActionBtn>
        <ActionBtn label="Mark" onClick={() => requireAuth(() => addToCart(false))}>
          <Heart className="h-5 w-5" />
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
      <CommentsSheet open={commentsOpen} onOpenChange={setCommentsOpen} productId={reel.id} />

      {/* Bottom info overlay — anchored at the very bottom */}
      <div className="absolute left-0 right-0 bottom-0 z-10 px-4 pt-6 pb-5 pr-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent text-white">
        <button
          onClick={reel.admin_posted ? undefined : goShop}
          className="text-sm font-semibold mb-1 inline-flex items-center gap-1"
        >
          @{reel.admin_posted
            ? (reel.admin_shop_name || 'p4no_official')
            : (reel.shop?.name || reel.seller?.full_name || 'seller')}
        </button>
        <h3 className="text-base font-bold line-clamp-2">{reel.title}</h3>
        {reel.description && (
          <p className="text-xs opacity-90 line-clamp-2 mt-1">{reel.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-sm font-bold">
            {formatPrice(reel.price, reel.currency_symbol)}
          </span>
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full h-8"
            onClick={() => navigate(productPath)}
          >
            View details
          </Button>
        </div>
      </div>
    </section>
  );
};

const ActionBtn = ({
  children,
  label,
  onClick,
  className,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
    <span
      className={cn(
        'w-12 h-12 rounded-full bg-white/15 backdrop-blur-md text-white flex items-center justify-center shadow-lg',
        className
      )}
    >
      {children}
    </span>
    <span className="text-[10px] text-white drop-shadow font-medium">{label}</span>
  </button>
);

export default ReelItem;
