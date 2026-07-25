import { cn } from "@/lib/utils";

interface DiscountPriceProps {
  originalPrice: number;
  discountPercentage: number;
  currencySymbol?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const DiscountPrice = ({ originalPrice, discountPercentage, currencySymbol = "Fr", size = "md", className }: DiscountPriceProps) => {
  const discountedPrice = originalPrice - (originalPrice * (discountPercentage / 100));

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('en-RW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  return (
    <div className={cn("flex flex-col", className)}>
      <span className={cn(
        "line-through text-muted-foreground",
        size === "sm" && "text-[10px]",
        size === "md" && "text-xs",
        size === "lg" && "text-sm",
      )}>
        {currencySymbol} {formatPrice(originalPrice)}
      </span>
      <span className={cn(
        "font-bold text-blue-600 dark:text-blue-400",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        size === "lg" && "text-xl",
      )}>
        {currencySymbol} {formatPrice(discountedPrice)}
      </span>
    </div>
  );
};

export default DiscountPrice;
