import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import CategoryPage from './CategoryPage';
import SitePage from './SitePage';
import NotFound from './NotFound';
import { loadCategoryRows } from '@/hooks/useCategories';

/**
 * Resolves a top-level /:slug to either a category page or a site page.
 * Priority: category first, then site_pages, then 404.
 */
const DynamicSlugPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [resolvedType, setResolvedType] = useState<'category' | 'site_page' | 'not_found' | null>(null);

  useEffect(() => {
    if (!slug) { setResolvedType('not_found'); return; }
    
    const resolve = async () => {
      setResolvedType(null);
      
      // Check category first
      // Static/cached category list — no per-slug PostgREST lookup.
      const cats = await loadCategoryRows().catch(() => [] as any[]);
      if (cats.some((c: any) => c.slug === slug)) { setResolvedType('category'); return; }

      // Check site_pages
      const { data: page } = await supabase
        .from('site_pages')
        .select('id')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();
      
      if (page) { setResolvedType('site_page'); return; }

      setResolvedType('not_found');
    };

    resolve();
  }, [slug]);

  if (resolvedType === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (resolvedType === 'category') return <CategoryPage />;
  if (resolvedType === 'site_page') return <SitePage />;
  return <NotFound />;
};

export default DynamicSlugPage;
