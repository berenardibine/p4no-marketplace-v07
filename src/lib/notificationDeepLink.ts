import { supabase } from '@/integrations/supabase/client';

export interface DeepLinkInput {
  type?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action_url?: string | null;
  actor_id?: string | null;
}

/**
 * Resolves a notification into the URL the user should land on.
 * Falls back to action_url if explicit deep-link rules don't match.
 */
export async function resolveNotificationUrl(n: DeepLinkInput): Promise<string> {
  // 1. Explicit action_url always wins
  if (n.action_url && n.action_url.trim()) return n.action_url;

  const type = (n.type || '').toLowerCase();
  const eType = (n.entity_type || '').toLowerCase();
  const eId = n.entity_id || null;

  // 2. Type-based routing
  try {
    // Question/answer threads on products
    if ((type === 'qa_reply' || type === 'qa_question' || type === 'question') && eType === 'product_question' && eId) {
      const { data } = await supabase
        .from('product_questions')
        .select('product_id, products(slug)')
        .eq('id', eId)
        .maybeSingle();
      const slug = (data as any)?.products?.slug || (data as any)?.product_id;
      if (slug) return `/product/${slug}#qa-${eId}`;
    }

    // Comments
    if (type === 'comment' || eType === 'product_comment') {
      if (eType === 'product' && eId) {
        const { data } = await supabase.from('products').select('slug').eq('id', eId).maybeSingle();
        if (data?.slug) return `/product/${data.slug}#comments`;
      }
      if (eType === 'product_comment' && eId) {
        const { data } = await supabase
          .from('product_comments')
          .select('product_id, products(slug)')
          .eq('id', eId)
          .maybeSingle();
        const slug = (data as any)?.products?.slug;
        if (slug) return `/product/${slug}#comments`;
      }
      if (eType === 'insight_article' && eId) {
        const { data } = await supabase.from('insight_articles').select('slug').eq('id', eId).maybeSingle();
        if (data?.slug) return `/insights/article/${data.slug}#comments`;
      }
    }

    // Article notifications
    if (type === 'article' || eType === 'insight_article') {
      if (eId) {
        const { data } = await supabase.from('insight_articles').select('slug').eq('id', eId).maybeSingle();
        if (data?.slug) return `/insights/article/${data.slug}`;
      }
      return '/insights';
    }

    // Badges / achievements
    if (type === 'badge' || type === 'achievement') {
      return '/account?tab=badges';
    }

    // Follows → seller / actor profile
    if (type === 'follow') {
      const profileId = eId || n.actor_id;
      if (profileId) return `/seller/${profileId}`;
    }

    // Reviews / ratings → product
    if (type === 'review' || type === 'rating') {
      if (eType === 'product' && eId) {
        const { data } = await supabase.from('products').select('slug').eq('id', eId).maybeSingle();
        if (data?.slug) return `/product/${data.slug}#reviews`;
      }
      if (eType === 'seller' && eId) return `/seller/${eId}`;
    }

    // Products: views milestone, trending, saved, new product, price drop, recommendation
    if (
      type === 'product' || type === 'new_product' || type === 'price_drop' ||
      type === 'trending' || type === 'recommendation' || type === 'save' ||
      type === 'saved' || eType === 'product'
    ) {
      if (eId) {
        const { data } = await supabase.from('products').select('slug').eq('id', eId).maybeSingle();
        if (data?.slug) return `/product/${data.slug}`;
      }
    }

    // Services
    if (type === 'service' || eType === 'service') {
      if (eId) {
        const { data } = await supabase.from('services').select('slug').eq('id', eId).maybeSingle();
        if (data?.slug) return `/connect/service/${data.slug}`;
      }
    }

    // Opportunities (future)
    if (type === 'opportunity' && eId) return `/opportunities/${eId}`;

    // Orders / messages
    if (type === 'order') return '/account?tab=orders';
    if (type === 'message') return '/notifications';
  } catch (err) {
    console.warn('[deepLink] resolver failed', err);
  }

  // 3. Final fallback
  return '/notifications';
}
