import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getContent } from '@/lib/cdnGuard';
import { isStrictStaticMode } from '@/lib/staticFlags';


export interface InsightCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface InsightArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: any;
  body_html: string | null;
  thumbnail_url: string | null;
  thumbnail_blur: string | null;
  category_id: string | null;
  author_id: string | null;
  tags: string[];
  meta_title: string | null;
  meta_description: string | null;
  seo_keywords: string[];
  og_image_url: string | null;
  status: 'draft' | 'published' | 'scheduled';
  published_at: string | null;
  scheduled_for: string | null;
  reading_time_min: number;
  view_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
  category?: InsightCategory | null;
}

const ARTICLE_FIELDS = '*, category:insight_categories(*)';

export const useInsightCategories = () =>
  useQuery({
    queryKey: ['insight-categories'],
    queryFn: async (): Promise<InsightCategory[]> => {
      const { data, error } = await (supabase as any)
        .from('insight_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

export const useInsightArticles = (opts: { categorySlug?: string; limit?: number; offset?: number; q?: string } = {}) =>
  useQuery({
    queryKey: ['insight-articles', opts],
    queryFn: async (): Promise<{ rows: InsightArticle[]; count: number }> => {
      const limit = opts.limit ?? 12;
      const offset = opts.offset ?? 0;

      // Static-first for default & category lists (page 0).
      if (!opts.q && offset === 0) {
        const path = opts.categorySlug ? `articles/category/${opts.categorySlug}` : 'articles/latest';
        const staticRows = await getContent<any[]>(path);
        if (Array.isArray(staticRows)) {
          const sliced = staticRows.slice(0, limit);
          return { rows: sliced as InsightArticle[], count: staticRows.length };
        }
        if (isStrictStaticMode()) return { rows: [], count: 0 };
      }

      if (isStrictStaticMode() && !opts.q) return { rows: [], count: 0 };

      let cat: { id: string } | null = null;
      if (opts.categorySlug) {
        const { data } = await (supabase as any)
          .from('insight_categories').select('id').eq('slug', opts.categorySlug).maybeSingle();
        cat = data;
      }
      let qb = (supabase as any)
        .from('insight_articles')
        .select(ARTICLE_FIELDS, { count: 'exact' })
        .eq('status', 'published')
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false });
      if (cat?.id) qb = qb.eq('category_id', cat.id);
      if (opts.q) qb = qb.or(`title.ilike.%${opts.q}%,excerpt.ilike.%${opts.q}%`);
      qb = qb.range(offset, offset + limit - 1);
      const { data, error, count } = await qb;
      if (error) throw error;
      return { rows: (data || []) as InsightArticle[], count: count || 0 };
    },
    staleTime: 5 * 60 * 1000,
  });


export const useInsightArticle = (slug: string | undefined) =>
  useQuery({
    queryKey: ['insight-article', slug],
    enabled: !!slug,
    queryFn: async (): Promise<InsightArticle | null> => {
      // Static-first article detail.
      const cached = await getContent<InsightArticle>(`article/${slug}`);
      if (cached) {
        (supabase as any).from('insight_articles')
          .update({ view_count: ((cached as any).view_count || 0) + 1 })
          .eq('id', (cached as any).id).then(() => {});
        return cached as InsightArticle;
      }
      if (isStrictStaticMode()) return null;
      const { data, error } = await (supabase as any)
        .from('insight_articles')
        .select(ARTICLE_FIELDS)
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        (supabase as any).from('insight_articles')
          .update({ view_count: (data.view_count || 0) + 1 })
          .eq('id', data.id).then(() => {});
      }
      return data as InsightArticle | null;
    },
  });


export const useRelatedInsights = (article: InsightArticle | null | undefined) =>
  useQuery({
    queryKey: ['insight-related', article?.id],
    enabled: !!article?.id,
    queryFn: async (): Promise<InsightArticle[]> => {
      if (!article) return [];
      let qb = (supabase as any)
        .from('insight_articles')
        .select(ARTICLE_FIELDS)
        .eq('status', 'published')
        .neq('id', article.id)
        .order('published_at', { ascending: false })
        .limit(6);
      if (article.category_id) qb = qb.eq('category_id', article.category_id);
      const { data } = await qb;
      return (data || []) as InsightArticle[];
    },
  });