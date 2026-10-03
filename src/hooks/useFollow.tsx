import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type FollowTarget = 'shop' | 'provider';

export const useFollow = (targetType: FollowTarget, targetId?: string | null) => {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [count, setCount] = useState(0);
  // Public follower counts are NOT fetched automatically (egress). They load
  // only on explicit interaction via loadCount(), or after a follow toggle.
  const [countLoaded, setCountLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadCount = useCallback(async () => {
    if (!targetId) return;
    const { count: c } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', targetType)
      .eq('target_id', targetId);
    setCount(c || 0);
    setCountLoaded(true);
  }, [targetType, targetId]);

  const refresh = useCallback(async () => {
    if (!targetId) return;
    if (user) {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .maybeSingle();
      setIsFollowing(!!data);
    } else {
      setIsFollowing(false);
    }
  }, [user, targetType, targetId]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async () => {
    if (!user || !targetId) return false;
    setLoading(true);
    try {
      if (isFollowing) {
        await supabase.from('follows').delete()
          .eq('follower_id', user.id)
          .eq('target_type', targetType)
          .eq('target_id', targetId);
      } else {
        await supabase.from('follows').insert({
          follower_id: user.id, target_type: targetType, target_id: targetId,
        });
        // Push: notify the followed provider
        if (targetType === 'provider') {
          import('@/lib/notifyEvent').then(({ notifyEvent }) =>
            notifyEvent({
              type: 'follow',
              target_user_id: targetId,
              url: '/account',
            })
          );
        }
      }
      await refresh();
      await loadCount();
      return true;
    } finally { setLoading(false); }
  };

  return { isFollowing, count, countLoaded, loadCount, loading, toggle, refresh };
};
