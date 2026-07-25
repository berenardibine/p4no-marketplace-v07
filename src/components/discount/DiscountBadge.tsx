import { cn } from "@/lib/utils";
import { Percent } from "lucide-react";

interface DiscountBadgeProps {
  percentage: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const DiscountBadge = ({ percentage, size = "md", className }: DiscountBadgeProps) => {
  if (!percentage || percentage <= 0) return null;

  return (
    <div className={cn(
      "bg-destructive text-destructive-foreground font-bold rounded-lg shadow-sm flex items-center gap-0.5",
      size === "sm" && "px-1.5 py-0.5 text-[10px]",
      size === "md" && "px-2 py-1 text-xs",
      size === "lg" && "px-3 py-1.5 text-sm",
      className
    )}>
      -{Math.round(percentage)}%
    </div>
  );
};

export default DiscountBadge;
