import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Star, ShieldCheck, Calendar, Phone, MessageCircle, Share2, Briefcase, Flag, Copy, Bookmark } from 'lucide-react';
import { useServiceBySlug } from '@/hooks/useServiceBySlug';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { optimizeCloudinaryUrl } from '@/lib/cloudinary';
import FollowButton from '@/components/social/FollowButton';
import SaveButton from '@/components/social/SaveButton';
import { sanitizePhone } from '@/lib/whatsappService';
import { useToast } from '@/hooks/use-toast';
import ReportModal from '@/components/products/ReportModal';
import ServiceComments from '@/components/services/ServiceComments';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import GuestPromptDialog from '@/components/auth/GuestPromptDialog';
import ServiceMetaTags from '@/components/seo/ServiceMetaTags';
import ServiceJsonLd from '@/components/seo/ServiceJsonLd';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import RelatedServices from '@/components/services/RelatedServices';
import { useLoader } from '@/hooks/useLoader';

const fmt = (n: number) => new Intl.NumberFormat().format(n);

const ServiceDetail = () => {
  const { slugOrId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { service, loading } = useServiceBySlug(slugOrId);
  const [reportOpen, setReportOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);
  const { requireAuth, promptOpen, setPromptOpen, isAuthenticated } = useRequireAuth();

  useLoader('Loading service details…', loading);

  useEffect(() => {
    if (service?.id) {
      // Public service view counters / analytics writes are permanently disabled.
      import('@/hooks/useBrowsingHistory').then(m => m.trackBrowsingHistory('service', service.id));
    }
  }, [service?.id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!service) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <Briefcase className="h-12 w-12 text-muted-foreground/40" />
      <p className="text-muted-foreground">Service not found</p>
      <Button onClick={() => navigate('/connect')}>Back to Connect</Button>
    </div>
  );

  const sym = service.currency_symbol || '';
  const price = service.pricing_type === 'negotiable' ? 'Negotiable'
    : service.pricing_type === 'starting_from' ? `From ${sym} ${fmt(Number(service.price || 0))}`
    : `${sym} ${fmt(Number(service.price || 0))}`;

  const images = service.images?.length ? service.images : ['/placeholder.svg'];
  const canonicalPath = `/connect/service/${service.slug || service.id}`;
  const shareUrl = `https://p4no-marketplace.vercel.app${canonicalPath}`;

  const handleCall = () => requireAuth(() => {
    const p = service.phone_number || service.seller?.call_number;
    if (p) window.open(`tel:${p}`, '_self');
    else toast({ title: 'Phone not available', variant: 'destructive' });
  });

  const handleWA = () => requireAuth(() => {
    const p = sanitizePhone(service.whatsapp_number || service.seller?.whatsapp_number);
    if (p) {
      const msg = `Hello, I found your service on P4NO and I would like more information about ${service.title}.`;
      window.open(`https://wa.me/${p}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      toast({ title: 'WhatsApp not available', variant: 'destructive' });
    }
  });

  const handleReport = () => requireAuth(() => setReportOpen(true));

  const handleShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title: service.title, url: shareUrl });
      else { await navigator.clipboard.writeText(shareUrl); toast({ title: 'Link copied!' }); }
    } catch {}
  };

  const handleCopyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); toast({ title: 'Link copied! 🔗' }); } catch {}
  };

  return (
    <>
      <ServiceMetaTags
        title={service.title}
        description={service.description}
        image={service.video_thumbnail || images[0]}
        url={shareUrl}
        price={service.price}
        pricingType={service.pricing_type}
        currencySymbol={service.currency_symbol}
        providerName={service.seller?.full_name || undefined}
      />
      <ServiceJsonLd
        title={service.title}
        description={service.description || service.short_description || ''}
        image={service.video_thumbnail || images[0]}
        url={shareUrl}
        price={service.pricing_type === 'negotiable' ? null : service.price}
        pricingType={service.pricing_type}
        providerName={service.seller?.full_name || undefined}
        rating={service.seller?.rating || null}
        ratingCount={service.seller?.rating_count || null}
        category={service.category || undefined}
        areaServed={(service.seller as any)?.location || (service.seller as any)?.country || undefined}
      />


      <div className="min-h-screen bg-background pb-8">
        <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b">
          <div className="flex items-center gap-3 h-14 px-4">
            <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="font-semibold text-sm truncate flex-1">{service.title}</h1>
            {isAuthenticated && <SaveButton itemType="service" itemId={service.id} className="w-9 h-9" />}
            <button onClick={handleShare} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="px-4 pt-3">
          <Breadcrumbs
            items={[
              { name: 'Home', url: '/' },
              { name: 'Connect', url: '/connect' },
              ...(service.category ? [{ name: service.category.replace(/-/g, ' '), url: `/connect/category/${service.category}` }] : []),
              { name: service.title, url: canonicalPath },
            ]}
            id="breadcrumb-service-visible-jsonld"
          />
        </div>

        <div className="lg:max-w-7xl lg:mx-auto lg:px-6 lg:pt-6 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-8 lg:items-start">
          {/* LEFT — Media (sticky on desktop) */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <div className="aspect-video lg:aspect-[4/3] bg-muted relative overflow-hidden lg:rounded-2xl lg:border lg:border-border/50">
              {service.video_url ? (
                <video src={service.video_url} poster={service.video_thumbnail || images[0]} controls className="w-full h-full object-cover" />
              ) : (
                <img src={optimizeCloudinaryUrl(images[currentImage])} alt={service.title} className="w-full h-full object-contain bg-white transition-transform duration-500 hover:scale-105" />
              )}
              {service.is_featured && <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground">Featured</Badge>}
            </div>

            {/* Gallery thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3 scrollbar-hide">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImage(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${i === currentImage ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img src={optimizeCloudinaryUrl(img)} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Secondary actions under image */}
            <div className="px-4 lg:px-0 pb-2">
              <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                <button onClick={handleShare} className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-muted hover:bg-muted/80 text-sm font-medium transition-colors">
                  <Share2 className="h-4 w-4" /> Share
                </button>
                {isAuthenticated && (
                  <div className="inline-flex">
                    <SaveButton itemType="service" itemId={service.id} className="!w-auto !h-auto !rounded-full !px-3 !py-2 !bg-muted hover:!bg-muted/80 text-sm font-medium" />
                  </div>
                )}
                <button onClick={handleReport} className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-muted hover:bg-muted/80 text-sm font-medium text-red-600 dark:text-red-400 transition-colors">
                  <Flag className="h-4 w-4" /> Report
                </button>
                <button onClick={handleCopyLink} className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-muted hover:bg-muted/80 text-sm font-medium transition-colors">
                  <Copy className="h-4 w-4" /> Copy Link
                </button>
              </div>
            </div>

            {/* Video reel thumbnail */}
            {service.video_url && (
              <div className="p-4 lg:px-0">
                <button
                  type="button"
                  onClick={() => navigate(`/connect/reels?start=${service.id}`)}
                  className="relative w-full aspect-[9/16] max-h-[420px] rounded-2xl overflow-hidden bg-black group shadow-lg"
                  aria-label="Play service video"
                >
                  <img src={optimizeCloudinaryUrl(service.video_thumbnail || images[0])} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60" />
                  <img src={optimizeCloudinaryUrl(service.video_thumbnail || images[0])} alt={`${service.title} video`} className="absolute inset-0 w-full h-full object-contain" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-white/25 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg viewBox="0 0 24 24" className="h-8 w-8 text-white fill-white ml-1"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  </div>
                  <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-pink-500/90 text-white text-xs font-bold flex items-center gap-1">
                    <svg viewBox="0 0 24 24" className="h-3 w-3 fill-white"><path d="M8 5v14l11-7z" /></svg>
                    Watch Reel
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 text-white text-xs opacity-90">Tap to watch fullscreen ✨</div>
                </button>
              </div>
            )}
          </div>

          {/* RIGHT — Info & actions */}
          <div className="p-4 space-y-4 lg:p-0">
            <div>
              <h2 className="text-2xl font-bold">{service.title}</h2>
              {service.short_description && <p className="text-sm text-muted-foreground mt-1">{service.short_description}</p>}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-bold">{price}</span>
                {service.category && (
                  <span className="px-3 py-1.5 rounded-full bg-secondary/10 text-secondary text-xs capitalize">{service.category.replace(/-/g, ' ')}</span>
                )}
                {service.location && <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{service.location}</span>}
                {service.years_experience ? (
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{service.years_experience}+ yrs exp</span>
                ) : null}
              </div>
            </div>

            {/* Provider card */}
            <button
              onClick={() => navigate(`/connect/provider/${service.seller_id}`)}
              className="w-full flex items-center gap-3 p-3 bg-card rounded-2xl border hover:border-primary/40 transition-colors text-left"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center">
                {service.seller?.profile_image
                  ? <img src={optimizeCloudinaryUrl(service.seller.profile_image)} className="w-full h-full object-cover" />
                  : <span className="font-bold text-primary">{(service.seller?.full_name || 'P')[0]}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="font-semibold text-sm truncate">{service.seller?.full_name || 'Provider'}</p>
                  {service.seller?.identity_verified && <ShieldCheck className="h-4 w-4 text-emerald-500" />}
                </div>
                {Number(service.seller?.rating) > 0 && (
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {Number(service.seller?.rating).toFixed(1)} ({service.seller?.rating_count})
                  </p>
                )}
              </div>
              <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                <FollowButton targetType="provider" targetId={service.seller_id} size="sm" />
              </div>
            </button>

            <div className="bg-muted/40 rounded-2xl p-4">
              <h3 className="font-semibold mb-1">About this service</h3>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">{service.description}</p>
            </div>

            {service.availability && (
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Availability</p>
                <p className="text-sm font-medium">{service.availability}</p>
              </div>
            )}

            {/* Primary CTAs */}
            <div className="bg-background rounded-2xl p-4 space-y-3 border border-border/50">
              <h3 className="font-semibold mb-2 text-foreground">Contact provider for this service</h3>

              <Button
                onClick={handleCall}
                size="lg"
                className="w-full gap-3 h-14 rounded-xl bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-600 text-primary-foreground font-bold shadow-lg"
              >
                <Phone className="h-5 w-5" />
                Request Service / Call Provider
              </Button>

              <Button
                onClick={handleWA}
                size="lg"
                className="w-full gap-3 h-14 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
              >
                <MessageCircle className="h-5 w-5" />
                Message Provider on WhatsApp
              </Button>

              <p className="text-center text-xs text-muted-foreground pt-1">
                🔒 Secure contact powered by Smart Technology
              </p>
            </div>

            {/* Comments */}
            <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/30">
              <ServiceComments serviceId={service.id} />
            </div>
          </div>
        </div>

        {/* Related services — full width */}
        <div className="px-4 lg:max-w-7xl lg:mx-auto lg:px-6 mt-6">
          <RelatedServices serviceId={service.id} category={service.category} />
        </div>

        <ReportModal
          isOpen={reportOpen}
          onClose={() => setReportOpen(false)}
          sellerId={service.seller_id}
          sellerName={service.seller?.full_name || 'Provider'}
        />

        <GuestPromptDialog
          open={promptOpen}
          onOpenChange={setPromptOpen}
          title="Create your free P4NO account"
          description="Sign in to interact with providers and services."
        />
      </div>
    </>
  );
};

export default ServiceDetail;
