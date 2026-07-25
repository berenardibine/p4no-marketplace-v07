import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBadges, BadgeDefinition } from './useBadges';

export interface BadgeProgress {
  definition: BadgeDefinition;
  earned: boolean;
  current: number;
  target: number;
  percent: number;
  howTo: string;
}

async function safeCount(query: any): Promise<number> {
  try {
    const { count } = await query;
    return count || 0;
  } catch { return 0; }
}

async function computeStats(userId: string) {
  const [products, orders, answers, articles, sellerReviews, productRatings, verification] = await Promise.all([
    safeCount(supabase.from('products').select('id', { count: 'exact', head: true }).eq('seller_id', userId)),
    safeCount(supabase.from('orders').select('id', { count: 'exact', head: true }).eq('seller_id', userId).eq('status', 'completed' as any)),
    safeCount(supabase.from('product_answers' as any).select('id', { count: 'exact', head: true }).eq('user_id', userId)),
    safeCount(supabase.from('insight_articles').select('id', { count: 'exact', head: true }).eq('author_id', userId as any)),
    safeCount(supabase.from('seller_reviews').select('id', { count: 'exact', head: true }).eq('buyer_id', userId)),
    safeCount(supabase.from('product_ratings').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
    (async () => {
      try {
        const { data } = await supabase.from('identity_verifications').select('status').eq('user_id', userId).maybeSingle();
        return (data as any)?.status === 'approved' ? 1 : 0;
      } catch { return 0; }
    })(),
  ]);
  // profile views - use weekly_views aggregate as proxy
  let profileViews = 0;
  try {
    const { data } = await supabase.from('weekly_views').select('view_count').eq('item_type', 'product').in('item_id',
      (await supabase.from('products').select('id').eq('seller_id', userId)).data?.map((p: any) => p.id) || []);
    profileViews = (data || []).reduce((a: number, b: any) => a + (b.view_count || 0), 0);
  } catch { /* ignore */ }

  return {
    products,
    orders,
    answers,
    articles,
    reviews: sellerReviews + productRatings,
    verified: verification,
    profileViews,
  };
}

function progressFor(def: BadgeDefinition, stats: any): { current: number; target: number; howTo: string } {
  const req = def.requirements || {};
  switch (req.type) {
    case 'verified':
      return { current: stats.verified, target: 1, howTo: 'Complete identity verification in your account.' };
    case 'orders':
      return { current: stats.orders, target: req.min || 1, howTo: `Complete ${req.min || 1} order${(req.min || 1) > 1 ? 's' : ''} as a seller.` };
    case 'first_product':
      return { current: Math.min(stats.products, 1), target: 1, howTo: 'Publish your very first product listing.' };
    case 'answers':
      return { current: stats.answers, target: req.min || 5, howTo: `Answer ${req.min || 5} product questions in the Q&A.` };
    case 'articles':
      return { current: stats.articles, target: req.min || 1, howTo: `Publish ${req.min || 1} article${(req.min || 1) > 1 ? 's' : ''} in P4NO Insights.` };
    case 'reviews':
      return { current: stats.reviews, target: req.min || 10, howTo: `Leave ${req.min || 10} helpful reviews.` };
    case 'streak':
      return { current: 0, target: req.days || 7, howTo: `Stay active ${req.days || 7} days in a row.` };
    case 'products':
      return { current: stats.products, target: req.min || 20, howTo: `Maintain ${req.min || 20} active listings.` };
    case 'profile_views':
      return { current: stats.profileViews, target: req.min || 1000, howTo: `Reach ${req.min || 1000} total product views.` };
    default:
      return { current: 0, target: 1, howTo: def.description };
  }
}

export const useBadgeProgress = (userId?: string) => {
  const { badges, allDefinitions, loading: badgesLoading } = useBadges(userId);
  const [progress, setProgress] = useState<BadgeProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const run = useCallback(async () => {
    if (!userId || allDefinitions.length === 0) { setLoading(false); return; }
    setLoading(true);
    const stats = await computeStats(userId);
    const earnedCodes = new Set(badges.map(b => b.badge_code));
    const out: BadgeProgress[] = allDefinitions.map((def) => {
      const earned = earnedCodes.has(def.code);
      const { current, target, howTo } = progressFor(def, stats);
      const percent = earned ? 100 : Math.min(100, Math.round((current / Math.max(target, 1)) * 100));
      return { definition: def, earned, current, target, percent, howTo };
    });
    out.sort((a, b) => Number(b.earned) - Number(a.earned) || b.percent - a.percent);
    setProgress(out);
    setLoading(false);
  }, [userId, allDefinitions, badges]);

  useEffect(() => { if (!badgesLoading) run(); }, [badgesLoading, run]);

  return { progress, loading: loading || badgesLoading, refetch: run };
};