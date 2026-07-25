import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getContent } from '@/lib/cdnGuard';
import { isStrictStaticMode } from '@/lib/staticFlags';


export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  type: string | null;
}

const iconMap: Record<string, string> = {
  'Crops': '🌾',
  'Crops and harvests': '🌾',
  'Fertilizers': '🔥',
  'Fruits and vegetables': '🍊',
  'Crop medecine': '💫',
  'House': '🏠',
  'Land': '🗺️',
  'Real estates': '🏘️',
  'Vehicles': '🚗',
  'Big machine': '🔧',
  'Beauty and personal care': '💄',
  'Construction materials': '🏗️',
  'Education and stationary': '📚',
  'Electronics': '💻',
  'Fashion and clothing': '👕',
  'Food and beverages': '🍔',
  'Furniture and home decorations': '🛋️',
  'Health and fitness': '💪',
  'Kitchen and appliances': '🍳',
  'Office equipment': '🖥️',
  'Other': '❓',
  'Sports and interntainment': '⚽',
  'For lent construction materials': '🏗️',
  'For lent house and apartment': '🏠',
  'For lent tools and machinery': '🔧',
  'For lent vehicles': '🚗',
  'For lent Weeding and party decorations': '🎉',
};

const decorate = (rows: any[]): Category[] =>
  rows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon || iconMap[c.name] || '📦',
    type: c.type ?? null,
  }));

export const useCategories = (type?: string) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let rows = await getContent<any[]>('categories/all');
        if (!rows && !isStrictStaticMode()) {
          const { data, error } = await supabase
            .from('categories')
            .select('id, name, slug, icon, type')
            .order('name');
          if (error) throw error;
          rows = data ?? [];
        }
        rows = rows ?? [];
        if (cancelled) return;
        const filtered = type ? rows.filter((c: any) => c.type === type) : rows;
        setCategories(decorate(filtered));
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type]);

  return { categories, loading, error, refetch: () => {} };
};


export const useCategoriesByType = () => {
  const [categoriesByType, setCategoriesByType] = useState<Record<string, Category[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let rows = await getContent<any[]>('categories/all');
      if (!rows && !isStrictStaticMode()) {
        const { data } = await supabase
          .from('categories')
          .select('id, name, slug, icon, type')
          .order('name');
        rows = data ?? [];
      }
      rows = rows ?? [];
      if (cancelled) return;
      const grouped = decorate(rows).reduce((acc, cat) => {
        const t = cat.type || 'general';
        (acc[t] ||= []).push(cat);
        return acc;
      }, {} as Record<string, Category[]>);
      setCategoriesByType(grouped);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };

  }, []);

  return { categoriesByType, loading };
};
