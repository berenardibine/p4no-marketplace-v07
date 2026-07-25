import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface ProductPerformance {
  productId: string;
  title: string;
  images: string[];
  impressions: number;
  views: number;
  conversionRate: number;
}

interface SourceBreakdown {
  source: string;
  count: number;
  percentage: number;
}

interface AnalyticsSummary {
  totalImpressions: number;
  totalViews: number;
  avgConversionRate: number;
  topProducts: ProductPerformance[];
  sourceBreakdown: SourceBreakdown[];
  dailyTrend: Array<{ date: string; impressions: number; views: number }>;
}

interface GlobalAnalytics extends AnalyticsSummary {
  suspiciousProducts: Array<{ productId: string; title: string; impressions: number; views: number }>;
  categoryEngagement: Array<{ category: string; impressions: number; views: number }>;
}

// Helper to fetch all rows with pagination (bypasses 1000 row limit)
async function fetchAllPaginated(
  tableName: string,
  selectColumns: string,
  filters: { column: string; operator: string; value: any }[] = [],
  pageSize: number = 1000
): Promise<any[]> {
  const allData: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = (supabase as any).from(tableName).select(selectColumns).range(offset, offset + pageSize - 1);
    
    for (const filter of filters) {
      if (filter.operator === 'in') {
        query = query.in(filter.column, filter.value);
      } else if (filter.operator === 'gte') {
        query = query.gte(filter.column, filter.value);
      } else if (filter.operator === 'eq') {
        query = query.eq(filter.column, filter.value);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    if (data && data.length > 0) {
      allData.push(...data);
      offset += data.length;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

// Hook for seller's own product analytics
export const useSellerAnalytics = (days: number = 30) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, title, images')
        .eq('seller_id', user.id);

      if (productsError) throw productsError;
      if (!products || products.length === 0) {
        setAnalytics({ totalImpressions: 0, totalViews: 0, avgConversionRate: 0, topProducts: [], sourceBreakdown: [], dailyTrend: [] });
        setLoading(false);
        return;
      }

      const productIds = products.map(p => p.id);

      const impressions = await fetchAllPaginated('product_impressions', 'product_id, ref_source, created_at', [
        { column: 'product_id', operator: 'in', value: productIds },
        { column: 'created_at', operator: 'gte', value: startDate.toISOString() }
      ]);

      const views = await fetchAllPaginated('product_views', 'product_id, ref_source, created_at', [
        { column: 'product_id', operator: 'in', value: productIds },
        { column: 'created_at', operator: 'gte', value: startDate.toISOString() }
      ]);

      const impressionsByProduct = new Map<string, number>();
      const viewsByProduct = new Map<string, number>();
      const sourceCount = new Map<string, number>();
      const dailyData = new Map<string, { impressions: number; views: number }>();

      impressions.forEach((imp: any) => {
        impressionsByProduct.set(imp.product_id, (impressionsByProduct.get(imp.product_id) || 0) + 1);
        sourceCount.set(imp.ref_source || 'unknown', (sourceCount.get(imp.ref_source || 'unknown') || 0) + 1);
        const date = new Date(imp.created_at).toISOString().split('T')[0];
        const existing = dailyData.get(date) || { impressions: 0, views: 0 };
        existing.impressions++;
        dailyData.set(date, existing);
      });

      views.forEach((view: any) => {
        viewsByProduct.set(view.product_id, (viewsByProduct.get(view.product_id) || 0) + 1);
        const date = new Date(view.created_at).toISOString().split('T')[0];
        const existing = dailyData.get(date) || { impressions: 0, views: 0 };
        existing.views++;
        dailyData.set(date, existing);
      });

      const totalImpressions = impressions.length;
      const totalViews = views.length;
      const avgConversionRate = totalImpressions > 0 ? (totalViews / totalImpressions) * 100 : 0;

      const topProducts: ProductPerformance[] = products
        .map(p => ({
          productId: p.id, title: p.title, images: p.images || [],
          impressions: impressionsByProduct.get(p.id) || 0,
          views: viewsByProduct.get(p.id) || 0,
          conversionRate: impressionsByProduct.get(p.id) ? ((viewsByProduct.get(p.id) || 0) / impressionsByProduct.get(p.id)!) * 100 : 0
        }))
        .sort((a, b) => b.views - a.views).slice(0, 10);

      const totalSourceCount = Array.from(sourceCount.values()).reduce((a, b) => a + b, 0);
      const sourceBreakdown: SourceBreakdown[] = Array.from(sourceCount.entries())
        .map(([source, count]) => ({ source, count, percentage: totalSourceCount > 0 ? (count / totalSourceCount) * 100 : 0 }))
        .sort((a, b) => b.count - a.count);

      const dailyTrend: Array<{ date: string; impressions: number; views: number }> = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(); date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyTrend.push({ date: dateStr, ...(dailyData.get(dateStr) || { impressions: 0, views: 0 }) });
      }

      setAnalytics({ totalImpressions, totalViews, avgConversionRate, topProducts, sourceBreakdown, dailyTrend });
    } catch (err: any) {
      console.error('Error fetching seller analytics:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [user, days]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);
  return { analytics, loading, error, refetch: fetchAnalytics };
};

// Hook for admin global analytics
export const useAdminProductAnalytics = (days: number = 30) => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<GlobalAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const products: any[] = await fetchAllPaginated('products', 'id, title, images, category');

      const impressions: any[] = await fetchAllPaginated('product_impressions', 'product_id, ref_source, created_at', [
        { column: 'created_at', operator: 'gte', value: startDate.toISOString() }
      ]);

      const views: any[] = await fetchAllPaginated('product_views', 'product_id, ref_source, created_at', [
        { column: 'created_at', operator: 'gte', value: startDate.toISOString() }
      ]);

      const impressionsByProduct = new Map<string, number>();
      const viewsByProduct = new Map<string, number>();
      const sourceCount = new Map<string, number>();
      const dailyData = new Map<string, { impressions: number; views: number }>();
      const categoryData = new Map<string, { impressions: number; views: number }>();
      const productMap = new Map(products.map((p: any) => [p.id, p]));

      impressions.forEach((imp: any) => {
        impressionsByProduct.set(imp.product_id, (impressionsByProduct.get(imp.product_id) || 0) + 1);
        sourceCount.set(imp.ref_source || 'unknown', (sourceCount.get(imp.ref_source || 'unknown') || 0) + 1);
        const date = new Date(imp.created_at).toISOString().split('T')[0];
        const existing = dailyData.get(date) || { impressions: 0, views: 0 };
        existing.impressions++;
        dailyData.set(date, existing);
        const product = productMap.get(imp.product_id);
        if (product?.category) {
          const catData = categoryData.get(product.category) || { impressions: 0, views: 0 };
          catData.impressions++;
          categoryData.set(product.category, catData);
        }
      });

      views.forEach((view: any) => {
        viewsByProduct.set(view.product_id, (viewsByProduct.get(view.product_id) || 0) + 1);
        const date = new Date(view.created_at).toISOString().split('T')[0];
        const existing = dailyData.get(date) || { impressions: 0, views: 0 };
        existing.views++;
        dailyData.set(date, existing);
        const product = productMap.get(view.product_id);
        if (product?.category) {
          const catData = categoryData.get(product.category) || { impressions: 0, views: 0 };
          catData.views++;
          categoryData.set(product.category, catData);
        }
      });

      const totalImpressions = impressions.length;
      const totalViews = views.length;
      const avgConversionRate = totalImpressions > 0 ? (totalViews / totalImpressions) * 100 : 0;

      const topProducts: ProductPerformance[] = products
        .map((p: any) => ({
          productId: p.id, title: p.title, images: p.images || [],
          impressions: impressionsByProduct.get(p.id) || 0,
          views: viewsByProduct.get(p.id) || 0,
          conversionRate: impressionsByProduct.get(p.id) ? ((viewsByProduct.get(p.id) || 0) / impressionsByProduct.get(p.id)!) * 100 : 0
        }))
        .sort((a: any, b: any) => b.views - a.views).slice(0, 10);

      const suspiciousProducts = products
        .filter((p: any) => {
          const imps = impressionsByProduct.get(p.id) || 0;
          const vws = viewsByProduct.get(p.id) || 0;
          return imps > 1000 && vws === 0;
        })
        .map((p: any) => ({ productId: p.id, title: p.title, impressions: impressionsByProduct.get(p.id) || 0, views: viewsByProduct.get(p.id) || 0 }));

      const totalSourceCount = Array.from(sourceCount.values()).reduce((a, b) => a + b, 0);
      const sourceBreakdown: SourceBreakdown[] = Array.from(sourceCount.entries())
        .map(([source, count]) => ({ source, count, percentage: totalSourceCount > 0 ? (count / totalSourceCount) * 100 : 0 }))
        .sort((a, b) => b.count - a.count);

      const dailyTrend: Array<{ date: string; impressions: number; views: number }> = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(); date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyTrend.push({ date: dateStr, ...(dailyData.get(dateStr) || { impressions: 0, views: 0 }) });
      }

      const categoryEngagement = Array.from(categoryData.entries())
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.impressions - a.impressions);

      setAnalytics({ totalImpressions, totalViews, avgConversionRate, topProducts, sourceBreakdown, dailyTrend, suspiciousProducts, categoryEngagement });
    } catch (err: any) {
      console.error('Error fetching admin analytics:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);
  return { analytics, loading, error, refetch: fetchAnalytics };
};

// Hook for single product analytics
export const useSingleProductAnalytics = (productId: string | undefined, days: number = 30) => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<{
    impressions: number;
    views: number;
    conversionRate: number;
    dailyTrend: Array<{ date: string; impressions: number; views: number }>;
    sourceBreakdown: SourceBreakdown[];
  } | null>(null);

  useEffect(() => {
    if (!productId) { setLoading(false); return; }

    const fetchData = async () => {
      try {
        setLoading(true);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const [impressions, views] = await Promise.all([
          fetchAllPaginated('product_impressions', 'ref_source, created_at', [
            { column: 'product_id', operator: 'eq', value: productId },
            { column: 'created_at', operator: 'gte', value: startDate.toISOString() }
          ]),
          fetchAllPaginated('product_views', 'ref_source, created_at', [
            { column: 'product_id', operator: 'eq', value: productId },
            { column: 'created_at', operator: 'gte', value: startDate.toISOString() }
          ])
        ]);

        const sourceCount = new Map<string, number>();
        const dailyData = new Map<string, { impressions: number; views: number }>();

        impressions.forEach((imp: any) => {
          sourceCount.set(imp.ref_source || 'unknown', (sourceCount.get(imp.ref_source || 'unknown') || 0) + 1);
          const date = new Date(imp.created_at).toISOString().split('T')[0];
          const existing = dailyData.get(date) || { impressions: 0, views: 0 };
          existing.impressions++;
          dailyData.set(date, existing);
        });

        views.forEach((view: any) => {
          const date = new Date(view.created_at).toISOString().split('T')[0];
          const existing = dailyData.get(date) || { impressions: 0, views: 0 };
          existing.views++;
          dailyData.set(date, existing);
        });

        const dailyTrend: Array<{ date: string; impressions: number; views: number }> = [];
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date(); date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          dailyTrend.push({ date: dateStr, ...(dailyData.get(dateStr) || { impressions: 0, views: 0 }) });
        }

        const totalSourceCount = Array.from(sourceCount.values()).reduce((a, b) => a + b, 0);
        const sourceBreakdown: SourceBreakdown[] = Array.from(sourceCount.entries())
          .map(([source, count]) => ({ source, count, percentage: totalSourceCount > 0 ? (count / totalSourceCount) * 100 : 0 }))
          .sort((a, b) => b.count - a.count);

        setAnalytics({
          impressions: impressions.length, views: views.length,
          conversionRate: impressions.length > 0 ? (views.length / impressions.length) * 100 : 0,
          dailyTrend, sourceBreakdown
        });
      } catch (err) {
        console.error('Error fetching product analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [productId, days]);

  return { analytics, loading };
};
