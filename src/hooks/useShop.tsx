import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Shop {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  whatsapp: string | null;
  province_id: string | null;
  district_id: string | null;
  sector_id: string | null;
  trading_center: string | null;
  market_center: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export const useMyShop = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchShop();
    } else {
      setShop(null);
      setLoading(false);
    }
  }, [user]);

  const fetchShop = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('seller_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setShop(data as Shop | null);
    } catch (err) {
      console.error('Error fetching shop:', err);
    } finally {
      setLoading(false);
    }
  };

  const createShop = async (shopData: Partial<Shop>) => {
    if (!user) return { error: 'Not authenticated' };

    try {
      const { data, error } = await supabase
        .from('shops')
        .insert({
          name: shopData.name || 'My Shop',
          seller_id: user.id,
          description: shopData.description,
          logo_url: shopData.logo_url,
          contact_phone: shopData.contact_phone,
          contact_email: shopData.contact_email,
          whatsapp: shopData.whatsapp,
          trading_center: shopData.trading_center,
        })
        .select()
        .single();

      if (error) throw error;
      setShop(data as Shop);
      toast({
        title: "Shop created",
        description: "Your shop has been created successfully!",
      });
      return { error: null };
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to create shop",
        variant: "destructive",
      });
      return { error: err.message };
    }
  };

  const updateShop = async (updates: Partial<Shop>) => {
    if (!user || !shop) return { error: 'Not authenticated or no shop' };

    try {
      const { error } = await supabase
        .from('shops')
        .update(updates)
        .eq('id', shop.id);

      if (error) throw error;
      setShop(prev => prev ? { ...prev, ...updates } : null);
      toast({
        title: "Shop updated",
        description: "Your shop has been updated successfully!",
      });
      return { error: null };
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update shop",
        variant: "destructive",
      });
      return { error: err.message };
    }
  };

  return { shop, loading, createShop, updateShop, refetch: fetchShop };
};

export const useShopProducts = (shopId?: string) => {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState({
    totalViews: 0,
    totalLikes: 0,
    activeProducts: 0,
    pendingProducts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user || shopId) {
      fetchProducts();
    }
  }, [user, shopId]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (shopId) {
        query = query.eq('shop_id', shopId);
      } else if (user) {
        query = query.eq('seller_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const productList = data || [];
      setProducts(productList);

      // Calculate analytics
      const totalViews = productList.reduce((sum, p) => sum + (p.views || 0), 0);
      const totalLikes = productList.reduce((sum, p) => sum + (p.likes || 0), 0);
      const activeProducts = productList.filter(p => p.status === 'active').length;
      const pendingProducts = productList.filter(p => p.status === 'pending').length;

      setAnalytics({ totalViews, totalLikes, activeProducts, pendingProducts });
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  return { products, analytics, loading, refetch: fetchProducts };
};
