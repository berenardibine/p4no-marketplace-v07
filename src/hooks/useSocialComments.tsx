import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type CommentTarget = 'product' | 'service' | 'reel';

export interface SocialComment {
  id: string;
  target_type: CommentTarget;
  target_id: string;
  parent_id: string | null;
  user_id: string;
  author_name: string | null;
  content: string;
  created_at: string;
  is_deleted: boolean;
}

export const useSocialComments = (targetType: CommentTarget, targetId: string | null | undefined) => {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('social_comments')
      .select('*')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    if (!error) setComments((data || []) as SocialComment[]);
    setLoading(false);
  }, [targetType, targetId]);

  useEffect(() => { load(); }, [load]);

  const post = async (content: string, parentId?: string | null) => {
    if (!user || !targetId) return { error: new Error('not authenticated') };
    const { error } = await supabase.from('social_comments').insert({
      target_type: targetType,
      target_id: targetId,
      parent_id: parentId ?? null,
      user_id: user.id,
      author_name: profile?.full_name ?? null,
      content,
    });
    if (!error) await load();
    return { error };
  };

  const remove = async (id: string) => {
    if (!user) return;
    await supabase.from('social_comments').update({ is_deleted: true }).eq('id', id).eq('user_id', user.id);
    await load();
  };

  return { comments, loading, post, remove, refresh: load };
};
