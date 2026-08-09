import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { startPageView } from '@/lib/requestBudget';

/**
 * Starts a fresh per-page request budget on every navigation.
 * Purely in-memory — no network, no database, no timers.
 */
export default function RouteBudgetTracker() {
  const location = useLocation();
  useEffect(() => {
    startPageView(location.pathname);
  }, [location.pathname]);
  return null;
}
