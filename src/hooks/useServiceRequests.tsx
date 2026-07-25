import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useServiceRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) { setRequests([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('service_requests')
      .select('*, services(title, slug, images)')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false });
    setRequests(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { refetch(); }, [refetch]);

  // realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`seller-service-requests-${user.id}-${Math.random().toString(36).slice(2, 10)}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `seller_id=eq.${user.id}` },
        () => refetch()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refetch]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('service_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (!error) await refetch();
    return !error;
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return { requests, loading, refetch, updateStatus, pendingCount };
}
