import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { getContent } from '@/lib/cdnGuard';
import { isStrictStaticMode } from '@/lib/staticFlags';

export interface Shop {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  whatsapp: string | null;
  trading_center: string | null;
  province_id: string | null;
  district_id: string | null;
  sector_id: string | null;
  is_active: boolean | null;
  seller_id: string;
  owner_id: string | null;
  created_at: string | null;
  delivery_rules?: any[] | null;
}

export const useMyShop = () => {
  const { user, profile } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMyShop();
    }
  }, [user]);

  const fetchMyShop = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data } = await supabase
        .from('shops')
        .select('*')
        .eq('seller_id', user.id)
        .maybeSingle();

      setShop(data);
    } catch (err) {
      console.error('Error fetching shop:', err);
    } finally {
      setLoading(false);
    }
  };

  const createShop = async (shopData: Partial<Shop>) => {
    if (!user || !profile) return null;

    try {
      const { data, error } = await supabase
        .from('shops')
        .insert({
          seller_id: user.id,
          owner_id: user.id,
          name: shopData.name || `${profile.full_name}'s Shop`,
          description: shopData.description,
          logo_url: shopData.logo_url,
          cover_image_url: shopData.cover_image_url,
          contact_phone: profile.call_number || profile.phone_number,
          whatsapp: profile.whatsapp_number,
          trading_center: shopData.trading_center,
          delivery_rules: (shopData as any).delivery_rules ?? null,
          province_id: profile.province_id,
          district_id: profile.district_id,
          sector_id: profile.sector_id,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      setShop(data);
      return data;
    } catch (err: any) {
      console.error('Error creating shop:', err);
      throw err;
    }
  };

  const updateShop = async (shopData: Partial<Shop>) => {
    if (!shop) return null;

    try {
      const { data, error } = await supabase
        .from('shops')
        .update(shopData)
        .eq('id', shop.id)
        .select()
        .single();

      if (error) throw error;
      setShop(data);
      return data;
    } catch (err: any) {
      console.error('Error updating shop:', err);
      throw err;
    }
  };

  const deleteShop = async () => {
    if (!shop) return;

    try {
      const { error } = await supabase
        .from('shops')
        .delete()
        .eq('id', shop.id);

      if (error) throw error;
      setShop(null);
    } catch (err: any) {
      console.error('Error deleting shop:', err);
      throw err;
    }
  };

  return { shop, loading, createShop, updateShop, deleteShop, refetch: fetchMyShop };
};

export const useShop = (shopId: string | undefined) => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (shopId) {
      fetchShop();
    }
  }, [shopId]);

  const fetchShop = async () => {
    if (!shopId) return;
    
    try {
      setLoading(true);
      // Static-first: try `shops/${slug-or-id}` from CDN, then all-shops list,
      // then fall back to Supabase only outside strict mode.
      const staticShop = await getContent<any>(`shops/${shopId}`);
      if (staticShop) {
        setShop(staticShop as Shop);
        return;
      }
      const allShops = await getContent<any[]>('shops/all');
      if (Array.isArray(allShops)) {
        const match = allShops.find((s: any) => s.id === shopId || s.slug === shopId);
        if (match) { setShop(match as Shop); return; }
      }
      if (isStrictStaticMode()) { setShop(null); return; }
      const { data } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .single();
      setShop(data);
    } catch (err) {
      console.error('Error fetching shop:', err);
    } finally {
      setLoading(false);
    }
  };

  return { shop, loading };
};
