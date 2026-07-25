import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCachedServiceCategories } from '@/lib/contentCache';

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
}

export function useServiceCategories() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await getCachedServiceCategories();
      let rows = cached as any[] | null;
      if (!rows) {
        const { data } = await supabase
          .from('service_categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        rows = data ?? [];
      } else {
        rows = rows.filter((c: any) => c.is_active !== false);
      }
      if (cancelled) return;
      setCategories(rows as ServiceCategory[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, loading };
}
