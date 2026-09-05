import { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { 
  ArrowLeft, Heart, MessageCircle, Phone, Share2, 
  MapPin, Store, ShieldCheck, ChevronLeft, ChevronRight,
  Package, Tag, Home, Loader2, Flag, HelpCircle, Star, ShoppingBag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProductBySlug } from "@/hooks/useProductBySlug";
import ProductMetaTags from "@/components/seo/ProductMetaTags";
import ProductJsonLd from "@/components/seo/ProductJsonLd";
import BreadcrumbJsonLd from "@/components/seo/BreadcrumbJsonLd";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import ImageLightbox from "@/components/ui/image-lightbox";
import ReportModal from "@/components/products/ReportModal";
import ProductComments from "@/components/products/ProductComments";
import ProductQA from "@/components/products/ProductQA";
import QAJsonLd from "@/components/seo/QAJsonLd";
import StructuredProductDescription, { ProductFaqJsonLd, type StructuredDescription } from "@/components/products/StructuredProductDescription";
import RecentlyViewed from "@/components/home/RecentlyViewed";
import { trackBrowsingHistory } from "@/hooks/useBrowsingHistory";
import SellerRatingModal from "@/components/products/SellerRatingModal";
import SellerRatingDisplay from "@/components/products/SellerRatingDisplay";
import { useSellerReviews } from "@/hooks/useSellerReviews";
import DiscountBadge from "@/components/discount/DiscountBadge";
import DiscountCountdown from "@/components/discount/DiscountCountdown";
import { hasActiveDiscount, getDiscountedPrice } from "@/lib/discount";
import { cn } from "@/lib/utils";
import { useCart } from "@/context/CartContext";
import OrderNowButton from "@/components/order/OrderNowButton";
import FollowButton from "@/components/social/FollowButton";
import SaveButton from "@/components/social/SaveButton";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import FeatureGate from "@/components/system/FeatureGate";
import GuestPromptDialog from "@/components/auth/GuestPromptDialog";
import { Lock } from "lucide-react";
import { useLoader } from "@/hooks/useLoader";
import DeferUntilVisible from "@/components/util/DeferUntilVisible";

// Loading Component
const ProductLoader = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
    <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
    <p className="text-muted-foreground">Developed by Smart Technology</p>
  </div>
);

// Not Found Component — only for products that genuinely do not exist.
const ProductNotFound = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
    <div className="text-center max-w-md">
      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
        <Package className="h-10 w-10 text-primary/60" />
      </div>
      <h1 className="text-3xl font-bold text-primary mb-2">Product Not Found 😊</h1>
      <p className="text-muted-foreground mb-6">
        This product may have been removed or is no longer available.
      </p>
      <Button asChild size="lg" className="gap-2">
        <Link to="/">
          <Home className="h-5 w-5" />
          Browse Products
        </Link>
      </Button>
    </div>
  </div>
);

// Delivery failure (offline, CDN hiccup, cold-start timeout). The product very
// likely exists — offer a retry instead of telling the visitor it is gone.
const ProductUnavailable = ({ onRetry }: { onRetry: () => void }) => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
    <div className="text-center max-w-md">
      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
        <Package className="h-10 w-10 text-primary/60" />
      </div>
      <h1 className="text-2xl font-bold text-primary mb-2">Taking longer than usual</h1>
      <p className="text-muted-foreground mb-6">
        We couldn't load this product just now. Check your connection and try again.
      </p>
      <div className="flex items-center justify-center gap-2">
        <Button size="lg" className="gap-2" onClick={onRetry}>
          Try again
        </Button>
        <Button asChild size="lg" variant="outline" className="gap-2">
          <Link to="/">
            <Home className="h-5 w-5" />
            Browse
          </Link>
        </Button>
      </div>
    </div>
  </div>
);


const ProductDetail = () => {
  const { slugOrId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { product, loading, status, isSlugBased, refetch } = useProductBySlug(slugOrId);
  const [currentImage, setCurrentImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const sellerId = product?.seller?.id || product?.seller_id;
  const { averageRating, totalReviews, hasReviewed, submitReview } = useSellerReviews(sellerId);
  const cart = useCart();
  const { requireAuth, promptOpen, setPromptOpen, isAuthenticated } = useRequireAuth();

  useLoader('Loading product details…', loading);


  // Public view / impression / link analytics tracking is permanently disabled.
  useEffect(() => { if (product?.id) trackBrowsingHistory('product', product.id); }, [product?.id]);

  // Redirect old ID-based URLs to canonical slug-based URLs
  useEffect(() => {
    if (product?.slug && !isSlugBased && slugOrId !== product.slug) {
      navigate(`/products/${product.slug}`, { replace: true });
    }
  }, [product?.slug, isSlugBased, slugOrId, navigate]);

  // Handle invalid ID early
  if (!slugOrId) {
    return <ProductNotFound />;
  }

  // Canonical URL: always /products/:slug (prevents duplicate indexing of /p/, /product/, /by/:shop aliases)
  const productSlugOrId = product?.slug || product?.id;
  const canonicalPath = productSlugOrId ? `/products/${productSlugOrId}` : '/';
  const productUrl = `https://p4no-marketplace.vercel.app${canonicalPath}`;
  // Short shareable link (still canonicalized via <link rel="canonical">)
  const shareableUrl = productSlugOrId
    ? `https://p4no-marketplace.vercel.app/p/${productSlugOrId}`
    : window.location.href;

  const handleWhatsApp = () => requireAuth(() => {
    const phone = product?.contact_whatsapp || product?.seller?.whatsapp_number;
    if (phone) {
      const message = encodeURIComponent(`Hello! I'm interested in your product on p4no: ${shareableUrl}`);
      window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${message}`, '_blank');
    } else {
      toast({ title: "WhatsApp not available", variant: "destructive" });
    }
  });

  const handleCall = () => requireAuth(() => {
    const phone = product?.contact_call || product?.seller?.call_number;
    if (phone) {
      window.open(`tel:${phone}`, '_self');
    } else {
      toast({ title: "Phone number not available", variant: "destructive" });
    }
  });


  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: product?.title,
          text: `Check out this product: ${product?.title}`,
          url: shareableUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareableUrl);
        toast({ title: "Link copied to clipboard! 🔗" });
      }
    } catch (err) {
      console.log("Share cancelled");
    }
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Show loading state
  if (loading) {
    return <ProductLoader />;
  }

  // Only a definitive miss renders "not found"; delivery failures get a retry.
  if (!product) {
    if (status === 'not_found') return <ProductNotFound />;
    return <ProductUnavailable onRetry={() => void refetch()} />;
  }

  const images = product.images?.length > 0 ? product.images : ['/placeholder.svg'];

  return (
    <>
      {/* SEO Meta Tags */}
      <ProductMetaTags
        title={product.seo_title || product.title}
        description={product.seo_description || product.description}
        image={product.seo_image || images[0]}
        url={productUrl}
        price={product.price}
        currency={product.currency_code || 'RWF'}
        shopName={product.shop?.name || product.seller?.full_name}
      />
      {(() => {
        const isDiscounted = hasActiveDiscount(product.discount, product.discount_expiry);
        const currentPrice = isDiscounted ? getDiscountedPrice(product.price, product.discount!) : product.price;
        return (
          <ProductJsonLd
            title={product.seo_title || product.title}
            description={product.seo_description || product.description}
            image={product.seo_image || images[0]}
            images={images}
            url={productUrl}
            price={currentPrice > 0 ? currentPrice : undefined}
            originalPrice={isDiscounted ? product.price : undefined}
            currency={product.currency_code || 'RWF'}
            seller={product.shop?.name || product.seller?.full_name}
            location={product.location || undefined}
            category={product.category?.replace(/-/g, ' ')}
            sku={product.id}
            mpn={product.id}
            ratingValue={averageRating}
            ratingCount={totalReviews}
            brand={product.shop?.name || product.seller?.full_name}
          />
        );
      })()}
      <BreadcrumbJsonLd
        id="product-breadcrumb-jsonld"
        items={[
          { name: 'Home', url: 'https://p4no-marketplace.vercel.app/' },
          ...(product.category ? [{ name: product.category.replace(/-/g, ' '), url: `https://p4no-marketplace.vercel.app/category/${product.category}` }] : []),
          { name: product.title, url: productUrl },
        ]}
      />
      
      
      {/* Fullscreen Image Lightbox */}
      <ImageLightbox
        images={images}
        initialIndex={currentImage}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
      
      <div className="min-h-screen bg-background pb-8">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
          <div className="flex items-center justify-between p-4">
            <button 
              onClick={() => {
                if (window.history.length > 2) {
                  navigate(-1);
                } else {
                  navigate('/');
                }
              }}
              className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-semibold text-lg line-clamp-1 flex-1 mx-4">Product Details</h1>
            <div className="flex gap-2 items-center">
              <SaveButton itemType="product" itemId={product.id} className="w-10 h-10" />
              <button 
                onClick={handleShare}
                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="px-4 pb-2">
            <Breadcrumbs
              items={[
                { name: 'Home', url: '/' },
                ...(product.category ? [{ name: product.category.replace(/-/g, ' '), url: `/category/${product.category}` }] : []),
                { name: product.title, url: `/product/${product.slug || product.id}` },
              ]}
              id="breadcrumb-product-visible-jsonld"
            />
          </div>
        </div>

        {/* Desktop two-column wrapper */}
        <div className="lg:max-w-7xl lg:mx-auto lg:px-6 lg:pt-6 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-8 lg:items-start">
          {/* LEFT — Media + secondary actions (sticky on desktop) */}
          <div className="lg:sticky lg:top-20 lg:self-start">

        {/* Image Carousel - No zoom, click opens lightbox */}
        <div className="relative bg-background max-w-2xl mx-auto lg:max-w-none lg:mx-0 lg:rounded-2xl lg:overflow-hidden lg:border lg:border-border/50">
          <div 
            className="aspect-square md:aspect-[4/3] relative overflow-hidden cursor-pointer"
            onClick={() => setLightboxOpen(true)}
          >
            <img 
              src={images[currentImage]} 
              alt={product.title}
              className="w-full h-full object-contain bg-white"
              onError={(e) => {
                e.currentTarget.src = '/placeholder.svg';
              }}
            />

            {/* Discount Badge on Image */}
            {hasActiveDiscount(product.discount, product.discount_expiry) && (
              <div className="absolute top-3 right-3 z-10">
                <DiscountBadge percentage={product.discount!} size="lg" />
              </div>
            )}
            
            {/* Image Navigation */}
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentImage(prev => prev > 0 ? prev - 1 : images.length - 1); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentImage(prev => prev < images.length - 1 ? prev + 1 : 0); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
                
                {/* Dots */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => { e.stopPropagation(); setCurrentImage(idx); }}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        idx === currentImage 
                          ? "bg-primary w-6" 
                          : "bg-white/60 hover:bg-white"
                      )}
                    />
                  ))}
                </div>
              </>
            )}
            
            {/* Tap to view hint */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
              Tap to view full screen
            </div>
          </div>

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto scrollbar-hide bg-background">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImage(idx)}
                  className={cn(
                    "w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition-all",
                    idx === currentImage 
                      ? "border-primary shadow-lg shadow-primary/30" 
                      : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  <img 
                    src={img} 
                    alt="" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder.svg';
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Video Thumbnail — opens TikTok-style fullscreen reel */}
        {product.video_url && (
          <FeatureGate feature="reels_module">
          <div className="p-4 max-w-2xl mx-auto">
            <button
              type="button"
              onClick={() => requireAuth(() => navigate(`/reels?start=${product.id}`))}
              className="relative w-full aspect-[9/16] max-h-[420px] rounded-2xl overflow-hidden bg-black group shadow-lg"
              aria-label="Play product video"
            >
              {/* Blurred fill background so the product image is never cropped */}
              <img
                src={images[0] || product.video_thumbnail || '/placeholder.svg'}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
              />
              {/* Actual product image — shown at its correct size, no crop */}
              <img
                src={images[0] || product.video_thumbnail || '/placeholder.svg'}
                alt={`${product.title} video`}
                className="absolute inset-0 w-full h-full object-contain"
                loading="lazy"
              />

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
              <div className="absolute bottom-3 left-3 right-3 text-white text-xs opacity-90">
                Tap to watch fullscreen ✨
              </div>
            </button>
          </div>
          </FeatureGate>
        )}

            {/* Secondary actions under image */}
            <div className="px-4 lg:px-0 pb-2">
              <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
                  aria-label="Share product"
                >
                  <Share2 className="h-4 w-4" /> Share
                </button>
                <div className="inline-flex">
                  <SaveButton itemType="product" itemId={product.id} className="!w-auto !h-auto !rounded-full !px-3 !py-2 !bg-muted hover:!bg-muted/80 text-sm font-medium" />
                </div>
                <button
                  onClick={() => toast({ title: 'Compare', description: 'Compare list — coming soon.' })}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
                >
                  <Package className="h-4 w-4" /> Compare
                </button>
                <button
                  onClick={() => requireAuth(() => setReportModalOpen(true))}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-muted hover:bg-muted/80 text-sm font-medium text-red-600 dark:text-red-400 transition-colors"
                >
                  <Flag className="h-4 w-4" /> Report
                </button>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareableUrl);
                      toast({ title: 'Link copied! 🔗' });
                    } catch {}
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
                >
                  <Share2 className="h-4 w-4" /> Copy Link
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT — Product info */}
          <div>

        {/* Product Info */}
        <div className="p-4 space-y-4 max-w-2xl mx-auto lg:max-w-none lg:mx-0 lg:p-0">
          {/* Title & Price with Negotiable display */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold text-foreground">{product.title}</h1>
              {product.is_negotiable && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge className="bg-primary/10 text-primary border-primary/20 shrink-0 cursor-help">
                        <Tag className="h-3 w-3 mr-1" />
                        Negotiable
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Contact seller to negotiate the price</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="mt-2">
              {(() => {
                const isDiscounted = hasActiveDiscount(product.discount, product.discount_expiry);
                const discountedPrice = isDiscounted ? getDiscountedPrice(product.price, product.discount!) : product.price;

                if (product.is_negotiable && product.price > 0) {
                  return (
                    <div>
                      {isDiscounted && (
                        <div className="flex items-center gap-2 mb-1">
                          <DiscountCountdown expiryDate={product.discount_expiry!} />
                        </div>
                      )}
                      <p className="text-2xl font-bold text-primary">
                        From {isDiscounted ? (
                          <>
                            <span className="line-through text-muted-foreground text-lg">{formatPrice(product.price)}</span>
                            {' '}
                            <span className="text-blue-600 dark:text-blue-400">{formatPrice(discountedPrice)}</span>
                          </>
                        ) : formatPrice(product.price)}
                        <span className="text-base font-medium text-muted-foreground ml-2">(Negotiable)</span>
                        {product.rental_unit && (
                          <span className="text-lg font-medium text-muted-foreground">/{product.rental_unit}</span>
                        )}
                      </p>
                    </div>
                  );
                } else if (product.is_negotiable) {
                  return <p className="text-2xl font-bold text-primary">Price Negotiable</p>;
                } else if (product.price > 0) {
                  return (
                    <div>
                      {isDiscounted && (
                        <div className="flex items-center gap-2 mb-1">
                          <DiscountCountdown expiryDate={product.discount_expiry!} />
                        </div>
                      )}
                      {isDiscounted ? (
                        <div>
                          <p className="text-lg line-through text-muted-foreground">
                            {formatPrice(product.price)}
                          </p>
                          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                            {formatPrice(discountedPrice)}
                            {product.rental_unit && (
                              <span className="text-lg font-medium text-muted-foreground">/{product.rental_unit}</span>
                            )}
                          </p>
                        </div>
                      ) : (
                        <p className="text-3xl font-bold text-primary">
                          {formatPrice(product.price)}
                          {product.rental_unit && (
                            <span className="text-lg font-medium text-muted-foreground">/{product.rental_unit}</span>
                          )}
                        </p>
                      )}
                    </div>
                  );
                } else {
                  return <p className="text-2xl font-bold text-primary">Price Negotiable</p>;
                }
              })()}
            </div>
            {product.admin_posted && (
              <Badge className="mt-2 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                
              </Badge>
            )}
          </div>

          {/* Quick Info */}
          <div className="flex flex-wrap gap-3">
            {product.quantity && product.quantity > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-muted">
                <Package className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{product.quantity} available</span>
              </div>
            )}
            {product.location && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-muted">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm">{product.location}</span>
              </div>
            )}
            {product.product_type && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-muted">
                <span className="text-sm capitalize">{product.product_type}</span>
              </div>
            )}
            {product.category && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-secondary/10 text-secondary">
                <span className="text-sm capitalize">{product.category.replace(/-/g, ' ')}</span>
              </div>
            )}
          </div>

          {/* Description with Read More */}
          {(() => {
            const structured = (product as any).description_structured as StructuredDescription | null | undefined;
            if (structured && (structured.overview || structured.key_benefits?.length)) {
              return (
                <div className="bg-muted/50 rounded-2xl p-4">
                  <h3 className="font-semibold mb-3">Description</h3>
                  <StructuredProductDescription data={structured} />
                  <ProductFaqJsonLd faqs={structured.faqs} />
                </div>
              );
            }
            const desc = product.description || '';
            const isLong = desc.length > 350;
            const preview = isLong && !descExpanded ? desc.slice(0, Math.floor(desc.length / 2)).trimEnd() + '…' : desc;
            return (
              <div className="bg-muted/50 rounded-2xl p-4">
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                  {preview}
                </p>
                {isLong && (
                  <button
                    type="button"
                    onClick={() => setDescExpanded(v => !v)}
                    className="mt-2 text-sm font-semibold text-primary hover:underline"
                  >
                    {descExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            );
          })()}

          {/* Recently Viewed by user — under description */}
          <DeferUntilVisible minHeight={140}>
            <FeatureGate feature="recently_viewed">
              <RecentlyViewed itemType="product" excludeId={product.id} />
            </FeatureGate>
          </DeferUntilVisible>

          {/* Seller Info */}
          {!product.admin_posted ? (
            <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                Seller Information
              </h3>
              <div 
                className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity" 
                onClick={() => product.shop?.id && navigate(`/shop/${product.shop.id}`)}
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center overflow-hidden">
                  {product.shop?.logo_url || product.seller?.profile_image ? (
                    <img 
                      src={product.shop?.logo_url || product.seller?.profile_image || ''} 
                      alt="" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Store className="h-6 w-6 text-primary-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">
                      {product.shop?.name || product.seller?.full_name || 'Seller'}
                    </h4>
                    {(product.seller as any)?.identity_verified && (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1 text-xs">
                        <ShieldCheck className="h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  {product.shop?.trading_center && (
                    <p className="text-sm text-muted-foreground">
                      {product.shop.trading_center}
                    </p>
                  )}
                  <SellerRatingDisplay averageRating={averageRating} totalReviews={totalReviews} compact />
                </div>
                {product.shop?.id && (
                  <FollowButton targetType="shop" targetId={product.shop.id} size="sm" />
                )}
              </div>
              {!hasReviewed && (
                <Button
                  size="sm"
                  onClick={() => setRatingModalOpen(true)}
                  className="w-full mt-3 gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white"
                >
                  <Star className="h-4 w-4" /> Rate this Seller
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                Seller Information
              </h3>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Store className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">
                      {(product as any).admin_shop_name || 'P4no Marketplace'}
                    </h4>
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1 text-xs">
                      <ShieldCheck className="h-3 w-3" /> Official
                    </Badge>
                  </div>
                  {product.admin_location && (
                    <p className="text-sm text-muted-foreground">{product.admin_location}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Order Buttons — same flow as Mark: add to cart with quantity, then floating bar to checkout */}
          <div className="bg-background rounded-2xl p-4 space-y-3">
            <Button
              size="lg"
              onClick={() => requireAuth(() => {
                const sellId = product.seller?.id || product.seller_id;
                const ok = cart.addItem({
                  id: product.id,
                  title: product.title,
                  price: product.price,
                  image: images[0],
                  maxQuantity: product.quantity || 999,
                  minQuantity: (product as any).minimum_quantity || 1,
                  unlimitedQuantity: (product as any).unlimited_quantity || false,
                  sellerId: sellId,
                  sellerName: product.shop?.name || product.seller?.full_name || 'Seller',
                  currencySymbol: product.currency_symbol,
                });
                if (ok) navigate('/checkout');
              })}
              className="w-full gap-2 h-14 rounded-xl bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-600 text-primary-foreground font-bold shadow-lg"
            >
              <ShoppingBag className="h-5 w-5" />
              Order Now — Choose Quantity & Checkout
            </Button>
            <Button
              onClick={() => requireAuth(() => {
                const sellId = product.seller?.id || product.seller_id;
                cart.addItem({
                  id: product.id,
                  title: product.title,
                  price: product.price,
                  image: images[0],
                  maxQuantity: product.quantity || 999,
                  minQuantity: (product as any).minimum_quantity || 1,
                  unlimitedQuantity: (product as any).unlimited_quantity || false,
                  sellerId: sellId,
                  sellerName: product.shop?.name || product.seller?.full_name || 'Seller',
                  currencySymbol: product.currency_symbol,
                });
              })}
              variant="outline"
              size="lg"
              className="w-full gap-2 rounded-xl border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all"
            >
              <Heart className="h-4 w-4" />
              Mark / Add to Order List
            </Button>

          </div>

          {/* Contact Buttons Section */}
          <div className="bg-background rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold mb-3 text-foreground">Contact Seller For This product</h3>
            
            {/* Call Seller Button - Orange */}
            <Button
              onClick={handleCall}
              size="lg"
              className="w-full gap-3 h-14 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white transition-all duration-300 shadow-soft hover:shadow-elevated"
            >
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Phone className="h-5 w-5 text-white" />
              </div>
              <span className="flex-1 text-left font-semibold">Call Seller Directly</span>
            </Button>

            {/* WhatsApp Button - Green */}
            <Button
              onClick={handleWhatsApp}
              size="lg"
              className="w-full gap-3 h-14 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white transition-all duration-300 shadow-soft hover:shadow-elevated"
            >
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <span className="flex-1 text-left font-semibold">Contact Seller on WhatsApp</span>
            </Button>

            {/* Secure contact label */}
            <p className="text-center text-xs text-muted-foreground pt-2">
              🔒 Secure contact powered by Smart Technology 
            </p>
          </div>

          {/* Report Button - Red with warning */}
          <Button
            size="lg"
            onClick={() => requireAuth(() => setReportModalOpen(true))}
            className="w-full gap-3 h-14 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white transition-all duration-300 shadow-soft"
          >
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Flag className="h-5 w-5 text-white" />
            </div>
            <span className="flex-1 text-left font-semibold">⚠️ Report this product or seller</span>
          </Button>

          {/* Comments Section - Blue themed */}
          <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/30">
            {isAuthenticated ? (
              <DeferUntilVisible minHeight={120}>
                <ProductComments productId={product.id} />
              </DeferUntilVisible>
            ) : (
              <button
                type="button"
                onClick={() => setPromptOpen(true)}
                className="w-full flex items-center gap-3 text-left p-2"
              >
                <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center">
                  <Lock className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-foreground">Sign in to view & post comments</p>
                  <p className="text-xs text-muted-foreground">Create a free P4NO account to join the conversation.</p>
                </div>
              </button>
            )}
          </div>

          {/* Questions & Answers */}
          <div id="qa" className="bg-card rounded-2xl p-4 border">
            <DeferUntilVisible minHeight={120}>
              <ProductQA productId={product.id} productSellerId={product.seller_id} />
            </DeferUntilVisible>
          </div>
          <QAJsonLd productId={product.id} productName={product.title} />

        </div>
          </div>{/* /right col */}
        </div>{/* /desktop grid */}



        {/* Report Modal */}
        <ReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          productId={product.id}
          sellerId={product.seller?.id}
          productTitle={product.title}
          sellerName={product.shop?.name || product.seller?.full_name}
        />

        {/* Seller Rating Modal */}
        <SellerRatingModal
          isOpen={ratingModalOpen}
          onClose={() => setRatingModalOpen(false)}
          sellerName={product.shop?.name || product.seller?.full_name || 'Seller'}
          onSubmit={submitReview}
        />

        <GuestPromptDialog
          open={promptOpen}
          onOpenChange={setPromptOpen}
          title="Create your free P4NO account"
          description="Sign in to order, chat with sellers and interact with this product."
        />
      </div>
    </>

  );
};

export default ProductDetail;
