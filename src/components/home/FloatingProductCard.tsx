import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Crown, MapPin, Star, BadgeCheck } from "lucide-react";
import { useProductTracking } from "@/hooks/useProductTracking";
import DiscountCountdown from "@/components/discount/DiscountCountdown";
import { hasActiveDiscount, getDiscountedPrice } from "@/lib/discount";

interface FloatingProductCardProps {
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
  currencySymbol?: string | null;
  discount?: number | null;
  discountExpiry?: string | null;
  // Optional enrichments (graceful degradation if absent)
  rating?: number | null;
  reviewCount?: number | null;
  location?: string | null;
  sellerVerified?: boolean | null;
  /** Optional label shown as the lead corner badge (overrides default). */
  badgeLabel?: string | null;
  /** Tone for the lead badge */
  badgeTone?: "hot" | "new" | "trending" | "best";
}

const toneClasses: Record<string, string> = {
  hot: "bg-[#FF6B00] text-white",
  best: "bg-[#111111] text-white",
  new: "bg-emerald-600 text-white",
  trending: "bg-fuchsia-600 text-white",
};

const FloatingProductCard = ({
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
  refSource = "home",
  currencySymbol = "Fr",
  discount,
  discountExpiry,
  rating,
  reviewCount,
  location,
  sellerVerified,
  badgeLabel,
  badgeTone = "hot",
}: FloatingProductCardProps) => {
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { trackElement, recordView } = useProductTracking();

  useEffect(() => {
    if (cardRef.current && id) {
      trackElement(cardRef.current, id, refSource);
    }
  }, [id, refSource, trackElement]);

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat("en-RW", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const handleClick = () => {
    recordView(id, refSource);
    navigate(`/product/${slug || id}`);
  };

  const productImage = images?.[0] || "/placeholder.svg";
  const showSponsoredBadge = isSponsored && !hideSponsored && !isAdminPosted;
  const isDiscounted = hasActiveDiscount(discount, discountExpiry);
  const discountedPrice = isDiscounted ? getDiscountedPrice(price, discount!) : price;
  const finalPrice = isDiscounted ? discountedPrice : price;

  const showRating = typeof rating === "number" && rating > 0;
  const leadBadge = badgeLabel || (showSponsoredBadge ? "FEATURED" : null);

  // JSON-LD for SEO
  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: title,
    image: productImage,
    ...(showRating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: rating,
        reviewCount: reviewCount || 1,
      },
    }),
    offers: {
      "@type": "Offer",
      priceCurrency: "RWF",
      price: finalPrice > 0 ? finalPrice : undefined,
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <article
      ref={cardRef}
      onClick={handleClick}
      data-product-id={id}
      data-ref-source={refSource}
      itemScope
      itemType="https://schema.org/Product"
      className={cn(
        "group relative flex flex-col cursor-pointer overflow-hidden",
        "bg-white rounded-2xl border border-[#F2F2F2]",
        "shadow-[0_1px_2px_rgba(17,17,17,0.04),0_4px_12px_rgba(17,17,17,0.04)]",
        "transition-all duration-300 ease-out",
        "hover:shadow-[0_8px_24px_rgba(255,107,0,0.12),0_2px_6px_rgba(17,17,17,0.06)]",
        "hover:-translate-y-0.5 hover:border-[#FF6B00]/30",
        "active:scale-[0.985] active:transition-transform active:duration-100",
        showSponsoredBadge && "ring-1 ring-[#FF6B00]/40"
      )}
    >
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#FAFAFA]">
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#F4F4F4] to-[#EAEAEA] animate-pulse" />
        )}
        <img
          src={productImage}
          alt={title}
          loading="lazy"
          itemProp="image"
          onLoad={() => setImageLoaded(true)}
          onError={(e) => {
            e.currentTarget.src = "/placeholder.svg";
            setImageLoaded(true);
          }}
          className={cn(
            "w-full h-full object-cover",
            "transition-all duration-500 ease-out",
            "group-hover:scale-[1.06]",
            !imageLoaded && "opacity-0"
          )}
        />

        {/* Lead badges (top-left) */}
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1.5 pointer-events-none">
          {leadBadge && (
            <span
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase",
                "shadow-sm",
                toneClasses[badgeTone] || toneClasses.hot,
                leadBadge.toLowerCase().includes("new") && "animate-pulse"
              )}
            >
              {showSponsoredBadge && (
                <Crown className="inline h-3 w-3 -mt-0.5 mr-0.5" />
              )}
              {leadBadge}
            </span>
          )}
          {isDiscounted && discount! > 0 && (
            <span className="px-2 py-1 rounded-md text-[11px] font-extrabold bg-[#FF6B00] text-white shadow-sm">
              -{discount}%
            </span>
          )}
        </div>

      </div>

      {/* Content */}
      <div className="flex flex-col gap-1.5 p-3">
        {/* Title */}
        <h3
          itemProp="name"
          className="text-[13px] sm:text-sm font-medium text-[#111111] leading-snug line-clamp-2 min-h-[2.5em]"
        >
          {title}
        </h3>

        {/* Price block */}
        <div
          itemProp="offers"
          itemScope
          itemType="https://schema.org/Offer"
          className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5"
        >
          {price <= 0 || isNegotiable ? (
            <span className="font-bold text-[15px] text-[#FF6B00]">
              Negotiable
            </span>
          ) : (
            <>
              <span
                itemProp="price"
                content={String(finalPrice)}
                className="font-extrabold text-[15px] sm:text-base text-[#FF6B00] leading-none"
              >
                {currencySymbol || "Fr"} {formatPrice(finalPrice)}
                {rentalUnit && (
                  <span className="text-[11px] font-medium text-[#666666]">
                    /{rentalUnit}
                  </span>
                )}
              </span>
              {isDiscounted && (
                <span className="text-[11px] line-through text-[#999999] font-normal">
                  {currencySymbol || "Fr"} {formatPrice(price)}
                </span>
              )}
              <meta itemProp="priceCurrency" content="RWF" />
            </>
          )}
        </div>

        {/* Discount countdown */}
        {isDiscounted && discountExpiry && (
          <DiscountCountdown expiryDate={discountExpiry} compact />
        )}

        {/* Rating + reviews */}
        {showRating && (
          <div
            className="flex items-center gap-1 text-[11px] text-[#666666]"
            itemProp="aggregateRating"
            itemScope
            itemType="https://schema.org/AggregateRating"
          >
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-[#111111]" itemProp="ratingValue">
              {rating!.toFixed(1)}
            </span>
            {reviewCount ? (
              <span>
                (<span itemProp="reviewCount">{reviewCount}</span>)
              </span>
            ) : null}
          </div>
        )}

        {/* Trust + location row */}
        {(sellerVerified || location) && (
          <div className="flex items-center justify-between gap-2 pt-0.5 text-[10.5px] text-[#666666]">
            {sellerVerified ? (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                <BadgeCheck className="h-3 w-3" />
                Verified
              </span>
            ) : (
              <span />
            )}
            {location && (
              <span className="inline-flex items-center gap-0.5 truncate max-w-[60%]">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{location}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
};

export default FloatingProductCard;
