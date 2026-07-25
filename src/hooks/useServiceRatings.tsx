import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ServiceRating {
  id: string;
  service_id: string;
  user_id: string;
  rating: number;
  review: string | null;
  created_at: string;
}

export const useServiceRatings = (serviceId: string | null | undefined) => {
  const { user } = useAuth();
  const [ratings, setRatings] = useState<ServiceRating[]>([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [myRating, setMyRating] = useState<ServiceRating | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!serviceId) return;
    setLoading(true);
    const { data } = await supabase
      .from('service_ratings')
      .select('*')
      .eq('service_id', serviceId)
      .order('created_at', { ascending: false });
    const list = (data || []) as ServiceRating[];
    setRatings(list);
    setCount(list.length);
    setAverage(list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0);
    setMyRating(user ? list.find(r => r.user_id === user.id) || null : null);
    setLoading(false);
  }, [serviceId, user]);

  useEffect(() => { load(); }, [load]);

  const submit = async (rating: number, review?: string) => {
    if (!user || !serviceId) return { error: new Error('not authenticated') };
    const { error } = await supabase.from('service_ratings').upsert(
      { service_id: serviceId, user_id: user.id, rating, review: review || null },
      { onConflict: 'user_id,service_id' }
    );
    if (!error) await load();
    return { error };
  };

  return { ratings, average, count, myRating, loading, submit, refresh: load };
};
