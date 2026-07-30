import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isFeatureEnabled } from "@/lib/featureFlags";

const ordersOn = () => isFeatureEnabled('mark_order_system');

export const useSellerOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCount, setNewCount] = useState(0);

  const fetchOrders = async () => {
    if (!ordersOn()) { setOrders([]); setLoading(false); return; }
    if (!user) { setOrders([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*, products(title, images, price, currency_symbol, slug))')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });
      setOrders(data || []);
    } catch (err) {
      console.error('[useSellerOrders] fetch failed', err);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    if (!ordersOn()) return;
    try {
      await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    } catch (err) {
      console.error('[useSellerOrders] updateStatus failed', err);
    }
  };

  // Initial fetch + realtime subscription
  useEffect(() => {
    if (!user || !ordersOn()) return;
    fetchOrders();

    const channel = supabase
      .channel(`seller-orders-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `seller_id=eq.${user.id}` },
        () => {
          setNewCount(c => c + 1);
          fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `seller_id=eq.${user.id}` },
        () => fetchOrders()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const clearNewCount = () => setNewCount(0);

  return { orders, loading, updateOrderStatus, refetch: fetchOrders, newCount, clearNewCount };
};

export const useAdminOrders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*, products(title, images, price, currency_symbol)), profiles:seller_id(full_name, whatsapp_number)')
        .order('created_at', { ascending: false })
        .limit(200);
      setOrders(data || []);
    } catch (err) {
      console.error('[useAdminOrders] fetch failed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  return { orders, loading, refetch: fetchOrders };
};
