import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useFeature } from '@/hooks/useFeatureFlags';
import type { FeatureKey } from '@/lib/featureFlags';

interface Props {
  feature: FeatureKey | string;
  children: ReactNode;
  fallback?: ReactNode;
}

/** Renders children only while the module is enabled. Nothing mounts when off. */
export const FeatureGate = ({ feature, children, fallback = null }: Props) => {
  const enabled = useFeature(feature);
  if (!enabled) return <>{fallback}</>;
  return <>{children}</>;
};

/** Route-level guard: a disabled module's routes redirect home. */
export const FeatureRoute = ({ feature, children }: Props) => {
  const enabled = useFeature(feature);
  if (!enabled) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default FeatureGate;
