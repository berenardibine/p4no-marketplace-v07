import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  slug: string;
  is_published: boolean;
  view_count: number;
}

export const useHelpArticles = (category?: string) => {
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticles();
  }, [category]);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('help_articles')
        .select('*')
        .eq('is_published', true)
        .order('title', { ascending: true });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) throw error;
      setArticles(data as HelpArticle[] || []);
    } catch (err) {
      console.error('Error fetching help articles:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchArticles = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      return fetchArticles();
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('help_articles')
        .select('*')
        .eq('is_published', true)
        .or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
        .order('title', { ascending: true });

      if (error) throw error;
      setArticles(data as HelpArticle[] || []);
    } catch (err) {
      console.error('Error searching articles:', err);
    } finally {
      setLoading(false);
    }
  };

  return { articles, loading, searchArticles, refetch: fetchArticles };
};

export const useHelpCategories = () => {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('help_articles')
        .select('category')
        .eq('is_published', true);

      if (error) throw error;
      
      const uniqueCategories = [...new Set(data?.map(a => a.category) || [])];
      setCategories(uniqueCategories);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  return { categories, loading };
};
