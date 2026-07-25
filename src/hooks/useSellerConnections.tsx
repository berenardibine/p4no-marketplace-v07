import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { notifyEvent } from '@/lib/notifyEvent';

export const useSellerConnections = (sellerId?: string) => {
  const { user } = useAuth();
  const [connectionCount, setConnectionCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sellerId) {
      fetchConnectionData();
    }
  }, [sellerId, user]);

  const fetchConnectionData = async () => {
    if (!sellerId) return;
    
    setLoading(true);
    
    // Get connection count using raw query since table may not be in types yet
    const { count } = await (supabase as any)
      .from('seller_connections')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', sellerId);
    
    setConnectionCount(count || 0);

    // Check if current user is connected
    if (user) {
      const { data } = await (supabase as any)
        .from('seller_connections')
        .select('id')
        .eq('seller_id', sellerId)
        .eq('buyer_id', user.id)
        .maybeSingle();
      
      setIsConnected(!!data);
    }
    
    setLoading(false);
  };

  const toggleConnection = async () => {
    if (!user || !sellerId) return { error: 'Not authenticated' };

    if (isConnected) {
      const { error } = await (supabase as any)
        .from('seller_connections')
        .delete()
        .eq('seller_id', sellerId)
        .eq('buyer_id', user.id);

      if (!error) {
        setIsConnected(false);
        setConnectionCount(prev => Math.max(0, prev - 1));
      }
      return { error };
    } else {
      const { error } = await (supabase as any)
        .from('seller_connections')
        .insert({ seller_id: sellerId, buyer_id: user.id });

      if (!error) {
        setIsConnected(true);
        setConnectionCount(prev => prev + 1);
        // Notify the seller they have a new Connect connection
        notifyEvent({
          type: 'message',
          target_user_id: sellerId,
          title: 'New Connection',
          body: 'Someone just connected with you on P4NO Connect.',
          url: '/connect',
        });
      }
      return { error };
    }
  };

  return { 
    connectionCount, 
    isConnected, 
    loading, 
    toggleConnection,
    refetch: fetchConnectionData
  };
};

export const useMyConnections = () => {
  const { user } = useAuth();
  const [connections, setConnections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMyConnections();
    }
  }, [user]);

  const fetchMyConnections = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data } = await (supabase as any)
      .from('seller_connections')
      .select('seller_id')
      .eq('buyer_id', user.id);
    
    setConnections(data?.map((c: any) => c.seller_id) || []);
    setLoading(false);
  };

  return { connections, loading, refetch: fetchMyConnections };
};