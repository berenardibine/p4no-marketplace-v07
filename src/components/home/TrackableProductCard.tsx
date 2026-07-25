import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Crown, PlayCircle } from "lucide-react";
import { useProductTracking } from "@/hooks/useProductTracking";

interface TrackableProductCardProps {
  id: string;
  slug?: string;
  title: string;
  price: number;
  images: string[];
  rentalUnit?: string | null;
  isSponsored?: boolean | null;
  hideSponsored?: boolean | null;
  isAdminPosted?: boolean | null;
  isNegotiable?: boolean | null;
  refSource?: string;
  videoUrl?: string | null;
  videoThumbnail?: string | null;
}

const TrackableProductCard = ({
  id,
  slug,
  title,
  price,
  images,
  rentalUnit,
  isSponsored,
  hideSponsored,
  isAdminPosted,
  isNegotiable,
  refSource = 'home',
  videoUrl,
  videoThumbnail,
}: TrackableProductCardProps) => {
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { trackElement, recordView } = useProductTracking();

  // Setup impression tracking when card mounts
  useEffect(() => {
    if (cardRef.current && id) {
      trackElement(cardRef.current, id, refSource);
    }
  }, [id, refSource, trackElement]);

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleClick = () => {
    // Record view on click
    recordView(id, refSource);
    navigate(`/product/${slug || id}`);
  };

  const productImage = images?.[0] || videoThumbnail || '/placeholder.svg';

  // Don't show sponsored badge if hideSponsored is true OR if product is admin posted
  const showSponsoredBadge = isSponsored && !hideSponsored && !isAdminPosted;

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      data-product-id={id}
      data-ref-source={refSource}
      className={cn(
        "group relative bg-background rounded-2xl overflow-hidden cursor-pointer",
        "border-none p-3 md:p-4",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-1",
        showSponsoredBadge && "ring-2 ring-primary/30"
      )}
    >
      {/* Sponsored Badge - Only show if not hidden */}
      {showSponsoredBadge && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
          <Crown className="h-3 w-3" />
          Featured
        </div>
      )}

      {/* Product Image */}
      <div className="relative aspect-square w-full mb-3 overflow-hidden rounded-xl bg-background">
        {!imageLoaded && (
          <div className="absolute inset-0 bg-muted animate-pulse rounded-xl" />
        )}
        
        <img
          src={productImage}
          alt={title}
          onLoad={() => setImageLoaded(true)}
          className={cn(
            "w-full h-full object-contain max-h-[220px] mx-auto",
            "transition-all duration-300",
            "group-hover:scale-105",
            !imageLoaded && "opacity-0"
          )}
          style={{ 
            mixBlendMode: 'multiply',
            backgroundColor: 'white'
          }}
        />
        {videoUrl && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/reels?start=${id}`);
            }}
            className="absolute inset-0 flex items-center justify-center"
            aria-label="Play reel"
          >
            <div className="bg-black/55 rounded-full p-2 backdrop-blur-sm shadow-lg hover:scale-110 transition-transform">
              <PlayCircle className="h-8 w-8 text-white" />
            </div>
          </button>
        )}
      </div>

      {/* Product Info */}
      <div className="space-y-1.5">
        <h3 
          className="font-semibold text-foreground text-sm leading-tight line-clamp-2"
          style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 600 }}
        >
          {title}
        </h3>

        {/* Price with rental unit */}
        <p className="font-bold text-base text-primary">
          {price <= 0 || isNegotiable ? (
            'Price Negotiable'
          ) : (
            <>
              Fr {formatPrice(price)}
              {rentalUnit && <span className="text-xs font-medium text-muted-foreground">/{rentalUnit}</span>}
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default TrackableProductCard;
