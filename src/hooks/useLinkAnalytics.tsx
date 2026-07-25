import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Detect referrer source
const detectSource = (referrer: string): string => {
  if (!referrer) return 'direct';
  
  const referrerLower = referrer.toLowerCase();
  
  if (referrerLower.includes('facebook.com') || referrerLower.includes('fb.com')) return 'facebook';
  if (referrerLower.includes('whatsapp.com') || referrerLower.includes('wa.me')) return 'whatsapp';
  if (referrerLower.includes('twitter.com') || referrerLower.includes('x.com')) return 'twitter';
  if (referrerLower.includes('instagram.com')) return 'instagram';
  if (referrerLower.includes('telegram.org') || referrerLower.includes('t.me')) return 'telegram';
  if (referrerLower.includes('linkedin.com')) return 'linkedin';
  if (referrerLower.includes('tiktok.com')) return 'tiktok';
  if (referrerLower.includes('youtube.com')) return 'youtube';
  if (referrerLower.includes('google.com')) return 'google';
  if (referrerLower.includes('bing.com')) return 'bing';
  
  return 'other';
};

// Detect device type
const detectDeviceType = (): string => {
  const ua = navigator.userAgent.toLowerCase();
  
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
};

// Detect browser
const detectBrowser = (): string => {
  const ua = navigator.userAgent;
  
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  
  return 'Other';
};

// Storage keys for fraud detection
const CLICK_STORAGE_KEY = 'sm_click_history';
const CLICK_WINDOW_MS = 60000; // 1 minute
const MAX_CLICKS_PER_MINUTE = 20;
const MAX_SAME_PRODUCT_CLICKS = 3;

interface ClickRecord {
  productId: string;
  timestamp: number;
}

// Get click history from session storage
const getClickHistory = (): ClickRecord[] => {
  try {
    const stored = sessionStorage.getItem(CLICK_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

// Save click history
const saveClickHistory = (history: ClickRecord[]) => {
  sessionStorage.setItem(CLICK_STORAGE_KEY, JSON.stringify(history));
};

// Check for suspicious activity and return validation score
const validateClick = (productId: string): { score: number; issues: string[] } => {
  const now = Date.now();
  let history = getClickHistory();
  
  // Clean old records
  history = history.filter(h => now - h.timestamp < CLICK_WINDOW_MS);
  
  const issues: string[] = [];
  let score = 100;
  
  // Check total clicks in last minute
  if (history.length >= MAX_CLICKS_PER_MINUTE) {
    score -= 40;
    issues.push('Too many clicks in short time');
  }
  
  // Check same product clicks
  const sameProductClicks = history.filter(h => h.productId === productId).length;
  if (sameProductClicks >= MAX_SAME_PRODUCT_CLICKS) {
    score -= 30;
    issues.push('Repeated clicks on same product');
  }
  
  // Add current click to history
  history.push({ productId, timestamp: now });
  saveClickHistory(history);
  
  return { score: Math.max(0, score), issues };
};

// Hook to track link analytics
export const useLinkAnalytics = (productId: string | undefined) => {
  const { user } = useAuth();
  
  const trackView = useCallback(async () => {
    if (!productId) return;
    
    const referrer = document.referrer;
    const source = detectSource(referrer);
    const deviceType = detectDeviceType();
    const browser = detectBrowser();
    const userAgent = navigator.userAgent;
    
    // Validate click for fraud detection
    const { score, issues } = validateClick(productId);
    const isValid = score >= 60;
    
    try {
      // Insert analytics record
      const { data: analyticsRecord, error } = await supabase
        .from('link_analytics')
        .insert({
          product_id: productId,
          user_id: user?.id || null,
          source,
          referrer: referrer || null,
          user_agent: userAgent,
          event: 'view',
          device_type: deviceType,
          browser,
          validation_score: score,
          is_valid: isValid,
        })
        .select('id')
        .single();
      
      // If suspicious, log to invalid_clicks
      if (!isValid && analyticsRecord) {
        await supabase.from('invalid_clicks').insert({
          link_analytics_id: analyticsRecord.id,
          product_id: productId,
          reason: issues.join(', '),
          details: { issues, source, deviceType, browser },
          risk_score: 100 - score,
        });
      }
    } catch (err) {
      console.error('Failed to track analytics:', err);
    }
  }, [productId, user?.id]);
  
  useEffect(() => {
    trackView();
  }, [trackView]);
};

// Hook to get analytics data for a product
export const useProductAnalytics = (productId: string | undefined) => {
  const fetchAnalytics = useCallback(async () => {
    if (!productId) return null;
    
    const { data, error } = await supabase
      .from('link_analytics')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching analytics:', error);
      return null;
    }
    
    // Calculate summary
    const totalClicks = data?.length || 0;
    const uniqueVisitors = new Set(data?.map(d => d.user_agent)).size;
    const sources: Record<string, number> = {};
    
    data?.forEach(d => {
      sources[d.source || 'direct'] = (sources[d.source || 'direct'] || 0) + 1;
    });
    
    const topSource = Object.entries(sources)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'direct';
    
    return {
      totalClicks,
      uniqueVisitors,
      sources,
      topSource,
      lastClick: data?.[0]?.created_at || null,
      records: data,
    };
  }, [productId]);
  
  return { fetchAnalytics };
};

// Hook to get all analytics for seller dashboard
export const useSellerAnalytics = () => {
  const { user } = useAuth();
  
  const fetchAllAnalytics = useCallback(async () => {
    if (!user) return null;
    
    // Get seller's products first
    const { data: products } = await supabase
      .from('products')
      .select('id, title, slug, images')
      .eq('seller_id', user.id);
    
    if (!products || products.length === 0) return { products: [], summary: null };
    
    const productIds = products.map(p => p.id);
    
    // Get analytics for all products
    const { data: analytics } = await supabase
      .from('link_analytics')
      .select('*')
      .in('product_id', productIds)
      .order('created_at', { ascending: false });
    
    // Calculate per-product stats
    const productStats = products.map(product => {
      const productAnalytics = analytics?.filter(a => a.product_id === product.id) || [];
      const uniqueVisitors = new Set(productAnalytics.map(a => a.user_agent)).size;
      const sources: Record<string, number> = {};
      
      productAnalytics.forEach(a => {
        sources[a.source || 'direct'] = (sources[a.source || 'direct'] || 0) + 1;
      });
      
      const topSource = Object.entries(sources)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || '-';
      
      return {
        ...product,
        totalClicks: productAnalytics.length,
        uniqueVisitors,
        topSource,
        lastClick: productAnalytics[0]?.created_at || null,
        sources,
      };
    });
    
    // Overall summary
    const totalClicks = analytics?.length || 0;
    const uniqueVisitors = new Set(analytics?.map(a => a.user_agent)).size;
    const allSources: Record<string, number> = {};
    
    analytics?.forEach(a => {
      allSources[a.source || 'direct'] = (allSources[a.source || 'direct'] || 0) + 1;
    });
    
    return {
      products: productStats.sort((a, b) => b.totalClicks - a.totalClicks),
      summary: {
        totalClicks,
        uniqueVisitors,
        sources: allSources,
        topProducts: productStats.slice(0, 5),
      },
    };
  }, [user]);
  
  return { fetchAllAnalytics };
};

// Hook for admin analytics
export const useAdminAnalytics = () => {
  const fetchSiteAnalytics = useCallback(async () => {
    // Get all analytics
    const { data: analytics } = await supabase
      .from('link_analytics')
      .select(`
        *,
        product:products(id, title, slug, seller_id, seller:profiles!products_seller_id_fkey(full_name))
      `)
      .order('created_at', { ascending: false })
      .limit(1000);
    
    // Get invalid clicks
    const { data: invalidClicks } = await supabase
      .from('invalid_clicks')
      .select(`
        *,
        product:products(id, title, seller_id, seller:profiles!products_seller_id_fkey(full_name))
      `)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (!analytics) return null;
    
    // Calculate stats
    const totalClicks = analytics.length;
    const uniqueVisitors = new Set(analytics.map(a => a.user_agent)).size;
    
    // Top products by clicks
    const productClicks: Record<string, { count: number; product: any }> = {};
    analytics.forEach(a => {
      const pid = a.product_id;
      if (!productClicks[pid]) {
        productClicks[pid] = { count: 0, product: a.product };
      }
      productClicks[pid].count++;
    });
    
    const topProducts = Object.entries(productClicks)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 10)
      .map(([id, data]) => ({
        id,
        clicks: data.count,
        ...data.product,
      }));
    
    // Top sources
    const sources: Record<string, number> = {};
    analytics.forEach(a => {
      sources[a.source || 'direct'] = (sources[a.source || 'direct'] || 0) + 1;
    });
    
    const topSources = Object.entries(sources)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    return {
      totalClicks,
      uniqueVisitors,
      topProducts,
      topSources,
      invalidClicks: invalidClicks || [],
      recentAnalytics: analytics.slice(0, 50),
    };
  }, []);
  
  return { fetchSiteAnalytics };
};
