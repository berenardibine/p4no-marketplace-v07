import { Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface SellerFABProps {
  className?: string;
}

const SellerFAB = ({ className }: SellerFABProps) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/seller-dashboard')}
      className={cn(
        "fixed right-4 bottom-24 z-40 w-14 h-14 rounded-full",
        "bg-gradient-to-r from-secondary to-primary shadow-lg shadow-primary/30",
        "flex items-center justify-center",
        "hover:scale-110 active:scale-95 transition-all duration-300",
        "animate-pulse hover:animate-none",
        className
      )}
      aria-label="Seller Dashboard"
    >
      <Store className="h-6 w-6 text-white" />
    </button>
  );
};

export default SellerFAB;
