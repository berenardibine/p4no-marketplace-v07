import { useNavigate } from 'react-router-dom';
import { Shield, Store } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { cn } from '@/lib/utils';

interface DashboardFABsProps {
  /** Seller button shows only when this page already knows the user is a seller. */
  showSeller?: boolean;
  className?: string;
}

/**
 * Stacked, labeled dashboard shortcuts.
 * Lives in ONE fixed container so the two buttons can never overlap,
 * and each button is only rendered for users already authorized for it.
 */
const DashboardFABs = ({ showSeller = false, className }: DashboardFABsProps) => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAdmin();

  if (loading || (!showSeller && !isAdmin)) return null;

  return (
    <div
      className={cn(
        "fixed right-4 bottom-24 z-40",
        "flex flex-col items-end gap-3",
        className
      )}
    >
      {showSeller && (
        <button
          onClick={() => navigate('/seller-dashboard')}
          className={cn(
            "flex items-center gap-2 min-h-[48px] pl-4 pr-5 rounded-full",
            "bg-gradient-to-r from-secondary to-primary",
            "shadow-lg shadow-primary/30",
            "text-white text-sm font-semibold",
            "hover:scale-105 active:scale-95 transition-transform duration-200",
            "tap-highlight-none"
          )}
          aria-label="Seller Dashboard"
        >
          <Store className="h-5 w-5 shrink-0" />
          <span>Seller Dashboard</span>
        </button>
      )}

      {isAdmin && (
        <button
          onClick={() => navigate('/admin')}
          className={cn(
            "flex items-center gap-2 min-h-[48px] pl-4 pr-5 rounded-full",
            "bg-gradient-to-br from-purple-600 via-violet-500 to-indigo-600",
            "shadow-lg shadow-purple-500/40",
            "text-white text-sm font-semibold",
            "hover:scale-105 active:scale-95 transition-transform duration-200",
            "tap-highlight-none"
          )}
          aria-label="Admin Dashboard"
        >
          <Shield className="h-5 w-5 shrink-0" />
          <span>Admin Dashboard</span>
        </button>
      )}
    </div>
  );
};

export default DashboardFABs;
