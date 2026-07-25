import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  children: ReactNode;
  /** If true, allow guests through (e.g. checkout). */
  allowGuest?: boolean;
}

const LoadingFallback = () => (
  <div className="min-h-screen bg-background p-4">
    <div className="max-w-2xl mx-auto space-y-4 pt-4">
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  </div>
);

const ProtectedRoute = ({ children, allowGuest = false }: Props) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingFallback />;
  if (!user && !allowGuest) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
};

export default ProtectedRoute;
