import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Product } from './useProducts';

export const useFavoriteProducts = () => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    } else {
      setFavorites([]);
      setLoading(false);
    }
  }, [user]);

  const fetchFavorites = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_likes')
        .select(`
          product_id,
          products!product_likes_product_id_fkey(
            *,
            seller:profiles!products_seller_id_fkey(id, full_name, profile_image, whatsapp_number, call_number),
            shop:shops(id, name, logo_url, trading_center)
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      
      const products = data?.map(item => item.products).filter(Boolean) as Product[] || [];
      setFavorites(products);
    } catch (err) {
      console.error('Error fetching favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (productId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('product_likes')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId);
      
      setFavorites(prev => prev.filter(p => p.id !== productId));
    } catch (err) {
      console.error('Error removing favorite:', err);
    }
  };

  const isFavorite = (productId: string) => {
    return favorites.some(p => p.id === productId);
  };

  return { favorites, loading, removeFavorite, isFavorite, refetch: fetchFavorites };
};
