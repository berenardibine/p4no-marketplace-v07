import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProductViewsData {
  [productId: string]: {
    views: number;
    impressions: number;
  };
}

// Hook to fetch real views and impressions for a list of products
export const useProductViews = (productIds: string[]) => {
  const [viewsData, setViewsData] = useState<ProductViewsData>({});
  const [loading, setLoading] = useState(true);

  const fetchViewsData = useCallback(async () => {
    if (productIds.length === 0) {
      setViewsData({});
      setLoading(false);
      return;
    }

    try {
      // Fetch views count per product
      const { data: viewsRaw } = await supabase
        .from('product_views')
        .select('product_id')
        .in('product_id', productIds);

      // Fetch impressions count per product
      const { data: impressionsRaw } = await supabase
        .from('product_impressions')
        .select('product_id')
        .in('product_id', productIds);

      // Aggregate counts
      const result: ProductViewsData = {};
      productIds.forEach(id => {
        result[id] = { views: 0, impressions: 0 };
      });

      (viewsRaw || []).forEach(v => {
        if (result[v.product_id]) {
          result[v.product_id].views++;
        }
      });

      (impressionsRaw || []).forEach(i => {
        if (result[i.product_id]) {
          result[i.product_id].impressions++;
        }
      });

      setViewsData(result);
    } catch (err) {
      console.error('Error fetching product views:', err);
    } finally {
      setLoading(false);
    }
  }, [productIds.join(',')]);

  useEffect(() => {
    fetchViewsData();
  }, [fetchViewsData]);

  return { viewsData, loading, refetch: fetchViewsData };
};

// Hook to get total views and impressions for a seller
export const useSellerViewsStats = (sellerId: string | undefined) => {
  const [stats, setStats] = useState({ totalViews: 0, totalImpressions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        // Get seller's product IDs
        const { data: products } = await supabase
          .from('products')
          .select('id')
          .eq('seller_id', sellerId);

        if (!products || products.length === 0) {
          setStats({ totalViews: 0, totalImpressions: 0 });
          setLoading(false);
          return;
        }

        const productIds = products.map(p => p.id);

        // Count views
        const { count: viewsCount } = await supabase
          .from('product_views')
          .select('id', { count: 'exact', head: true })
          .in('product_id', productIds);

        // Count impressions
        const { count: impressionsCount } = await supabase
          .from('product_impressions')
          .select('id', { count: 'exact', head: true })
          .in('product_id', productIds);

        setStats({
          totalViews: viewsCount || 0,
          totalImpressions: impressionsCount || 0,
        });
      } catch (err) {
        console.error('Error fetching seller stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [sellerId]);

  return { stats, loading };
};
