import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ProductRequest {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_location: string | null;
  status: string;
  created_at: string;
  product?: {
    id: string;
    title: string;
    images: string[];
    price: number;
  };
}

export const useProductRequests = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ProductRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRequests();
      subscribeToRequests();
    }
  }, [user]);

  const fetchRequests = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data } = await supabase
        .from('product_requests')
        .select(`
          *,
          product:products(id, title, images, price)
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToRequests = () => {
    if (!user) return;

    const channel = supabase
      .channel(`product-requests-${user.id}-${Math.random().toString(36).slice(2, 10)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'product_requests',
          filter: `seller_id=eq.${user.id}`
        },
        (payload) => {
          setRequests(prev => [payload.new as ProductRequest, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const updateRequestStatus = async (requestId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('product_requests')
        .update({ status })
        .eq('id', requestId);

      if (error) throw error;
      
      setRequests(prev => 
        prev.map(r => r.id === requestId ? { ...r, status } : r)
      );
    } catch (err) {
      console.error('Error updating request:', err);
      throw err;
    }
  };

  return { requests, loading, updateRequestStatus, refetch: fetchRequests };
};

export const useSendRequest = () => {
  const { user, profile } = useAuth();
  const [sending, setSending] = useState(false);

  const sendRequest = async (productId: string, sellerId: string) => {
    if (!user || !profile) {
      throw new Error('You must be logged in to send a request');
    }

    try {
      setSending(true);
      
      // Check if request already exists
      const { data: existing } = await supabase
        .from('product_requests')
        .select('id')
        .eq('product_id', productId)
        .eq('buyer_id', user.id)
        .maybeSingle();

      if (existing) {
        throw new Error('You have already requested this product');
      }

      const { error } = await supabase
        .from('product_requests')
        .insert({
          product_id: productId,
          buyer_id: user.id,
          seller_id: sellerId,
          buyer_name: profile.full_name,
          buyer_phone: profile.phone_number || profile.call_number || '',
          buyer_location: null
        });

      if (error) throw error;
    } finally {
      setSending(false);
    }
  };

  return { sendRequest, sending };
};
