import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { allowLastResortRead } from '@/lib/apiFirewall';

export function useSellerServices() {
  const { user } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) { setServices([]); setLoading(false); return; }
    setLoading(true);
    allowLastResortRead('services');
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false });
    setServices(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { refetch(); }, [refetch]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('services').update({ status }).eq('id', id);
    if (!error) await refetch();
    return !error;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (!error) await refetch();
    return !error;
  };

  return { services, loading, refetch, updateStatus, remove };
}
