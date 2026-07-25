import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SellerRatingDisplayProps {
  averageRating: number;
  totalReviews: number;
  compact?: boolean;
  onClick?: () => void;
}

const SellerRatingDisplay = ({ averageRating, totalReviews, compact = false, onClick }: SellerRatingDisplayProps) => {
  if (totalReviews === 0 && compact) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 transition-opacity hover:opacity-80',
        onClick && 'cursor-pointer',
        !onClick && 'cursor-default'
      )}
    >
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              compact ? 'h-3.5 w-3.5' : 'h-4 w-4',
              averageRating >= star
                ? 'fill-amber-400 text-amber-400'
                : averageRating >= star - 0.5
                ? 'fill-amber-400/50 text-amber-400'
                : 'text-muted-foreground/20'
            )}
          />
        ))}
      </div>
      <span className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
        {totalReviews > 0 ? `${averageRating} (${totalReviews})` : 'No reviews yet'}
      </span>
    </button>
  );
};

export default SellerRatingDisplay;
