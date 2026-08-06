import { useState } from "react";
import { Heart, MapPin, Tag, Users, UserPlus, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useFavorites } from "@/hooks/useProducts";
import { useAuth, useAuthAction } from "@/hooks/useAuth";
import { useSellerConnections } from "@/hooks/useSellerConnections";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import DiscountBadge from "@/components/discount/DiscountBadge";
import DiscountCountdown from "@/components/discount/DiscountCountdown";
import { hasActiveDiscount, getDiscountedPrice } from "@/lib/discount";
import SaveButton from "@/components/social/SaveButton";

interface ProductCardProps {
  id: string;
  title: string;
  price: number;
  images: string[];
  location?: string | null;
  is_negotiable?: boolean | null;
  quantity?: number;
  category?: string | null;
  sellerId?: string;
  compact?: boolean;
  discount?: number | null;
  discountExpiry?: string | null;
  currencySymbol?: string | null;
}

const ProductCard = ({ 
  id, 
  title, 
  price, 
  images, 
  location, 
  is_negotiable,
  quantity,
  sellerId,
  compact = false,
  discount,
  discountExpiry,
  currencySymbol = "Fr",
}: ProductCardProps) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { withAuth } = useAuthAction();
  const { toast } = useToast();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { connectionCount, isConnected, toggleConnection, loading: connectionLoading } = useSellerConnections(sellerId);
  const [isAnimating, setIsAnimating] = useState(false);
  const favorite = isFavorite(id);
  const isDiscounted = hasActiveDiscount(discount, discountExpiry);
  const discountedPrice = isDiscounted ? getDiscountedPrice(price, discount!) : price;

  const handleClick = () => {
    // Redirect guests to auth page
    if (!user) {
      navigate('/auth');
      return;
    }
    navigate(`/product/${id}`);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    withAuth(() => {
      setIsAnimating(true);
      toggleFavorite(id);
      setTimeout(() => setIsAnimating(false), 300);
    });
  };

  const handleConnectClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) {
      navigate('/auth');
      return;
    }

    // Don't allow sellers to connect with themselves
    if (sellerId === user.id) {
      toast({ title: "You can't connect with yourself", variant: "destructive" });
      return;
    }

    const { error } = await toggleConnection();
    if (error) {
      toast({ title: "Failed to update connection", variant: "destructive" });
    } else {
      toast({ 
        title: isConnected ? "Disconnected from seller" : "Connected with seller! 🎉",
        description: isConnected ? "You've unfollowed this seller" : "You'll see more from this seller"
      });
    }
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const imageUrl = images?.[0] || '/placeholder.svg';

  // Don't show connect button for own products or if no seller ID
  const showConnectButton = sellerId && user?.id !== sellerId;

  return (
    <div 
      ref={prefetchRef}
      className={cn(
        "group relative bg-card rounded-2xl overflow-hidden cursor-pointer flex flex-col",
        "border border-border shadow-soft",
        "hover:shadow-elevated hover:border-primary/20 hover:scale-[1.02]",
        "transition-all duration-300 ease-out"
      )}
    >

      {/* Image Container */}
      <div 
        onClick={handleClick}
        className={cn(
          "relative overflow-hidden bg-muted",
          compact ? "aspect-square" : "aspect-[4/3]"
        )}
      >
        <img 
          src={imageUrl} 
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Save + Favorite Buttons */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5">
          <button
            onClick={handleFavoriteClick}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center",
              "backdrop-blur-md transition-all duration-200 tap-highlight-none shadow-sm",
              favorite 
                ? "bg-primary text-primary-foreground shadow-orange" 
                : "bg-white/90 text-muted-foreground hover:bg-white hover:text-primary"
            )}
          >
            <Heart 
              className={cn(
                "h-4 w-4 transition-all",
                favorite && "fill-current",
                isAnimating && "animate-bounce-subtle"
              )} 
            />
          </button>
          <SaveButton itemType="product" itemId={id} className="bg-white/90 hover:bg-white shadow-sm" />
        </div>

        {/* Badges Container */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5">
          {/* Negotiable Badge */}
          {is_negotiable && (
            <div className="px-2.5 py-1 rounded-full bg-primary shadow-sm">
              <span className="text-[10px] font-semibold text-primary-foreground flex items-center gap-1">
                <Tag className="h-2.5 w-2.5" />
                Negotiable
              </span>
            </div>
          )}

          {/* Discount Badge */}
          {isDiscounted && (
            <DiscountBadge percentage={discount!} size="sm" />
          )}

          {/* Connection Count Badge */}
          {sellerId && connectionCount > 0 && (
            <div className="px-2.5 py-1 rounded-full bg-secondary shadow-sm">
              <span className="text-[10px] font-semibold text-secondary-foreground flex items-center gap-1">
                <Users className="h-2.5 w-2.5" />
                {connectionCount}
              </span>
            </div>
          )}
        </div>

        {/* Quantity Badge */}
        {quantity !== undefined && quantity > 0 && (
          <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-sm">
            <span className="text-[10px] font-medium text-white">
              {quantity} available
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex-1 flex flex-col" onClick={handleClick}>
        <h3 className="font-semibold text-foreground text-sm line-clamp-2 mb-1.5 group-hover:text-primary transition-colors leading-tight">
          {title}
        </h3>
        <p className="font-bold text-primary text-base mb-2">
          {is_negotiable || price <= 0 ? (
            'Price Negotiable'
          ) : isDiscounted ? (
            <span className="flex flex-col">
              <span className="text-xs line-through text-muted-foreground font-normal">
                {currencySymbol} {new Intl.NumberFormat('en-RW', { minimumFractionDigits: 0 }).format(price)}
              </span>
              <span className="text-blue-600 dark:text-blue-400">
                {currencySymbol} {new Intl.NumberFormat('en-RW', { minimumFractionDigits: 0 }).format(discountedPrice)}
              </span>
            </span>
          ) : (
            formatPrice(price)
          )}
        </p>
        {isDiscounted && discountExpiry && (
          <DiscountCountdown expiryDate={discountExpiry} compact />
        )}
        {location && (
          <div className="flex items-center gap-1.5 text-muted-foreground mb-3">
            <MapPin className="h-3 w-3 text-primary shrink-0" />
            <span className="text-xs line-clamp-1">{location}</span>
          </div>
        )}
      </div>

      {/* Connect Button - Block Level */}
      {showConnectButton && (
        <div className="px-3 pb-3">
          <Button
            onClick={handleConnectClick}
            disabled={connectionLoading}
            variant={isConnected ? "secondary" : "default"}
            size="sm"
            className={cn(
              "w-full gap-2 text-xs font-medium transition-all",
              isConnected 
                ? "bg-secondary/20 text-secondary hover:bg-secondary/30 border border-secondary/30" 
                : "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-orange"
            )}
          >
            {isConnected ? (
              <>
                <UserCheck className="h-3.5 w-3.5" />
                Connected
              </>
            ) : (
              <>
                <UserPlus className="h-3.5 w-3.5" />
                Connect with Seller
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProductCard;
