import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from './useAdmin';

interface ModuleCounts {
  [module: string]: number;
}

export const useAdminNotifications = () => {
  const { isAdmin } = useAdmin();
  const [moduleCounts, setModuleCounts] = useState<ModuleCounts>({});
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    if (!isAdmin) return;

    try {
      // Fetch unread counts grouped by module
      const { data, error } = await supabase
        .from('notifications')
        .select('module')
        .eq('is_read', false)
        .not('module', 'is', null);

      if (error) throw error;

      const counts: ModuleCounts = {};
      let total = 0;
      (data || []).forEach((n: any) => {
        if (n.module) {
          counts[n.module] = (counts[n.module] || 0) + 1;
          total++;
        }
      });

      setModuleCounts(counts);
      setTotalUnread(total);
    } catch (err) {
      console.error('Error fetching admin notification counts:', err);
    }
  }, [isAdmin]);

  const fetchRecent = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .not('module', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentNotifications(data || []);
    } catch (err) {
      console.error('Error fetching recent notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    fetchCounts();
    fetchRecent();

    // Realtime subscription
    const channel = supabase
      .channel(`admin-notifications-badges-${Math.random().toString(36).slice(2, 10)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new as any;
          if (newNotif.module) {
            setModuleCounts(prev => ({
              ...prev,
              [newNotif.module]: (prev[newNotif.module] || 0) + 1,
            }));
            setTotalUnread(prev => prev + 1);
            setRecentNotifications(prev => [newNotif, ...prev.slice(0, 9)]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, fetchCounts, fetchRecent]);

  const markModuleAsRead = async (module: string) => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('module', module)
        .eq('is_read', false);

      if (error) throw error;

      setModuleCounts(prev => {
        const newCounts = { ...prev };
        const moduleCount = newCounts[module] || 0;
        delete newCounts[module];
        setTotalUnread(t => Math.max(0, t - moduleCount));
        return newCounts;
      });
    } catch (err) {
      console.error('Error marking module as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false)
        .not('module', 'is', null);

      if (error) throw error;

      setModuleCounts({});
      setTotalUnread(0);
      setRecentNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const getModuleCount = (moduleId: string): number => {
    return moduleCounts[moduleId] || 0;
  };

  return {
    moduleCounts,
    totalUnread,
    recentNotifications,
    loading,
    getModuleCount,
    markModuleAsRead,
    markAllAsRead,
    refetch: () => { fetchCounts(); fetchRecent(); },
  };
};
