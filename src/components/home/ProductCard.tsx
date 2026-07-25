import { useState } from "react";
import { Heart, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  image: string;
  location: string;
  isFavorite?: boolean;
  onFavoriteToggle?: (id: string) => void;
}

const ProductCard = ({ 
  id, 
  name, 
  price, 
  image, 
  location, 
  isFavorite = false,
  onFavoriteToggle 
}: ProductCardProps) => {
  const [favorite, setFavorite] = useState(isFavorite);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAnimating(true);
    setFavorite(!favorite);
    onFavoriteToggle?.(id);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="group relative bg-card rounded-2xl overflow-hidden shadow-soft card-hover border border-border/50">
      {/* Image */}
      <div className="aspect-square relative overflow-hidden bg-muted">
        <img 
          src={image} 
          alt={name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        
        {/* Favorite Button */}
        <button
          onClick={handleFavoriteClick}
          className={cn(
            "absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 tap-highlight-none",
            favorite 
              ? "bg-primary text-primary-foreground shadow-orange" 
              : "bg-white/90 text-muted-foreground hover:bg-white hover:text-primary"
          )}
        >
          <Heart 
            className={cn(
              "h-4 w-4 transition-all",
              favorite && "fill-current",
              isAnimating && "animate-heart-pop"
            )} 
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="font-medium text-foreground text-sm line-clamp-1 mb-1">
          {name}
        </h3>
        <p className="font-bold text-primary text-sm mb-1.5">
          {price <= 0 ? 'Price Negotiable' : formatPrice(price)}
        </p>
        <div className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="text-2xs line-clamp-1">{location}</span>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
