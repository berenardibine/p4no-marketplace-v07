import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BadgeDefinition {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  category: string;
  requirements: any;
  display_order: number;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_code: string;
  earned_at: string;
  expires_at: string | null;
  is_active: boolean;
  definition?: BadgeDefinition;
}

export const useBadges = (userId?: string) => {
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [allDefinitions, setAllDefinitions] = useState<BadgeDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data: defs } = await supabase
      .from('badge_definitions')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    setAllDefinitions((defs as any) || []);

    if (userId) {
      const { data: ub } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);
      const defMap = new Map(((defs as any) || []).map((d: any) => [d.code, d]));
      const merged = ((ub as any) || []).map((b: any) => ({ ...b, definition: defMap.get(b.badge_code) }));
      setBadges(merged);
    } else {
      setBadges([]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { badges, allDefinitions, loading, refetch: fetch };
};