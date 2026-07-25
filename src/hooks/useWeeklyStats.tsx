import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface WeeklyReport {
  weeklyViews: number;
  weeklyImpressions: number;
  lifetimeViews: number;
  lifetimeImpressions: number;
  growthViewsPct: number;
  growthImpressionsPct: number;
  suggestion: string | null;
  weekStart: string;
  weekEnd: string;
}

export const useWeeklyStats = () => {
  const { user } = useAuth();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [previousReport, setPreviousReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep backward compat: expose as "stats" with same shape
  const stats = report ? {
    totalViews: report.lifetimeViews,
    totalImpressions: report.lifetimeImpressions,
    weeklyViews: report.weeklyViews,
    weeklyImpressions: report.weeklyImpressions,
    products: [] as any[],
    weekStart: report.weekStart,
    weekEnd: report.weekEnd,
  } : null;

  const fetchStats = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    try {
      setLoading(true);
      setError(null);

      // Fetch latest 2 reports (current + previous week)
      const { data, error: err } = await supabase
        .from('seller_weekly_reports')
        .select('*')
        .eq('seller_id', user.id)
        .order('week_start', { ascending: false })
        .limit(2);

      if (err) throw err;

      if (data && data.length > 0) {
        const latest = data[0];
        setReport({
          weeklyViews: latest.weekly_views || 0,
          weeklyImpressions: latest.weekly_impressions || 0,
          lifetimeViews: latest.lifetime_views || 0,
          lifetimeImpressions: latest.lifetime_impressions || 0,
          growthViewsPct: Number(latest.growth_views_pct) || 0,
          growthImpressionsPct: Number(latest.growth_impressions_pct) || 0,
          suggestion: latest.suggestion,
          weekStart: latest.week_start,
          weekEnd: latest.week_end,
        });

        if (data.length > 1) {
          const prev = data[1];
          setPreviousReport({
            weeklyViews: prev.weekly_views || 0,
            weeklyImpressions: prev.weekly_impressions || 0,
            lifetimeViews: prev.lifetime_views || 0,
            lifetimeImpressions: prev.lifetime_impressions || 0,
            growthViewsPct: Number(prev.growth_views_pct) || 0,
            growthImpressionsPct: Number(prev.growth_impressions_pct) || 0,
            suggestion: prev.suggestion,
            weekStart: prev.week_start,
            weekEnd: prev.week_end,
          });
        }
      }
    } catch (err: any) {
      console.error('Error fetching weekly stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return { stats, report, previousReport, loading, error, refetch: fetchStats };
};
