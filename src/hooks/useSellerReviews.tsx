import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cachedQuery, invalidateQuery } from '@/lib/queryCache';

interface SellerReview {
  id: string;
  seller_id: string;
  buyer_id: string | null;
  device_id: string | null;
  rating: number;
  comment: string | null;
  source: string;
  created_at: string;
  buyer?: { full_name: string; profile_image: string | null };
}

const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('sm-device-id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('sm-device-id', deviceId);
  }
  return deviceId;
};

export const useSellerReviews = (sellerId?: string) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasReviewed, setHasReviewed] = useState(false);

  const fetchReviews = useCallback(async (force = false) => {
    if (!sellerId) return;
    setLoading(true);
    try {
      const key = `seller_reviews:${sellerId}`;
      if (force) invalidateQuery(key);
      // Slow-changing per seller: shared 5-minute cache + only the columns the
      // UI renders (was `select('*')` on every product view).
      const reviewsData = await cachedQuery<SellerReview[]>(
        key,
        async () => {
          const { data, error } = await supabase
            .from('seller_reviews')
            .select('id,seller_id,buyer_id,device_id,rating,comment,source,created_at')
            .eq('seller_id', sellerId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return (data || []) as SellerReview[];
        },
        { ttlMs: 5 * 60_000 },
      );

      setReviews(reviewsData);
      setTotalReviews(reviewsData.length);

      if (reviewsData.length > 0) {
        const avg = reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewsData.length;
        setAverageRating(Math.round(avg * 10) / 10);
      }

      // Check if current user/device already reviewed
      const deviceId = getDeviceId();
      const alreadyReviewed = reviewsData.some(r =>
        (user?.id && r.buyer_id === user.id) || r.device_id === deviceId
      );
      setHasReviewed(alreadyReviewed);
    } catch (err) {
      console.error('Error fetching seller reviews:', err);
    } finally {
      setLoading(false);
    }
  }, [sellerId, user?.id]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const submitReview = async (rating: number, comment?: string) => {
    if (!sellerId) throw new Error('No seller ID');
    
    const deviceId = getDeviceId();
    const reviewData: any = {
      seller_id: sellerId,
      rating,
      comment: comment || null,
      device_id: deviceId,
      source: user ? 'authenticated' : 'guest',
    };
    if (user) reviewData.buyer_id = user.id;

    const { error } = await supabase.from('seller_reviews').insert(reviewData);
    if (error) throw error;

    await fetchReviews(true);
  };

  return { reviews, averageRating, totalReviews, loading, hasReviewed, submitReview, refetch: fetchReviews };
};
