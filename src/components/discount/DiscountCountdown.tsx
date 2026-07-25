import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiscountCountdownProps {
  expiryDate: string;
  compact?: boolean;
  className?: string;
}

const DiscountCountdown = ({ expiryDate, compact = false, className }: DiscountCountdownProps) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [isExpired, setIsExpired] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date().getTime();
      const end = new Date(expiryDate).getTime();
      const distance = end - now;

      if (distance <= 0) {
        setIsExpired(true);
        setTimeLeft("Expired");
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

      setIsUrgent(days === 0);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
      } else {
        setTimeLeft(`${hours}h ${minutes}m`);
      }
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [expiryDate]);

  if (isExpired) return null;

  if (compact) {
    return (
      <span className={cn(
        "text-[10px] font-medium flex items-center gap-0.5",
        isUrgent ? "text-destructive" : "text-amber-600 dark:text-amber-400",
        className
      )}>
        <Clock className="h-2.5 w-2.5" />
        {timeLeft}
      </span>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full",
      isUrgent 
        ? "bg-destructive/10 text-destructive" 
        : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
      className
    )}>
      <Clock className="h-3 w-3" />
      <span>Ends in {timeLeft}</span>
    </div>
  );
};

export default DiscountCountdown;
