import { useParams, Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import InsightsTopNav from '@/components/insights/InsightsTopNav';
import PageMetaTags from '@/components/seo/PageMetaTags';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import ArticleCard from '@/components/insights/ArticleCard';
import { useInsightArticle, useRelatedInsights } from '@/hooks/useInsights';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Heart, Bookmark, MessageCircle, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ShareButtonGroup from '@/components/insights/ShareButtonGroup';
// BackButton merged into InsightsTopNav (showBack)

const InsightArticle = () => {
  const { slug } = useParams();
  const { data: article, isLoading } = useInsightArticle(slug);
  const { data: related = [] } = useRelatedInsights(article);
  const { user } = useAuth();
  const { toast } = useToast();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    if (!article) return;
    setLikeCount(article.like_count || 0);
    if (!user) return;
    (async () => {
      const [{ data: l }, { data: s }] = await Promise.all([
        (supabase as any).from('insight_article_likes').select('article_id').eq('article_id', article.id).eq('user_id', user.id).maybeSingle(),
        (supabase as any).from('insight_article_saves').select('article_id').eq('article_id', article.id).eq('user_id', user.id).maybeSingle(),
      ]);
      setLiked(!!l); setSaved(!!s);
    })();
  }, [article, user]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!article) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-lg font-bold">Article not found</p>
      <Link to="/insights" className="text-primary text-sm font-semibold">Back to Insights</Link>
    </div>
  );

  const canonical = `/insights/article/${article.slug}`;
  const image = article.og_image_url || article.thumbnail_url || undefined;
  const publishedAt = article.published_at || article.created_at;

  const toggleLike = async () => {
    if (!user) { toast({ title: 'Sign in to like articles' }); return; }
    if (liked) {
      await (supabase as any).from('insight_article_likes').delete().eq('article_id', article.id).eq('user_id', user.id);
      setLiked(false); setLikeCount((c) => Math.max(0, c - 1));
    } else {
      await (supabase as any).from('insight_article_likes').insert({ article_id: article.id, user_id: user.id });
      setLiked(true); setLikeCount((c) => c + 1);
    }
  };
  const toggleSave = async () => {
    if (!user) { toast({ title: 'Sign in to save articles' }); return; }
    if (saved) {
      await (supabase as any).from('insight_article_saves').delete().eq('article_id', article.id).eq('user_id', user.id);
      setSaved(false);
    } else {
      await (supabase as any).from('insight_article_saves').insert({ article_id: article.id, user_id: user.id });
      setSaved(true);
    }
  };
  return (
    <div className="min-h-screen bg-background pb-16">
      <PageMetaTags
        title={article.meta_title || `${article.title} — P4NO Insights`}
        description={article.meta_description || article.excerpt || article.title}
        image={image}
        url={canonical}
        type="article"
      />
      <ArticleJsonLd article={article} url={canonical} />
      <ViewTracker articleId={article.id} userId={user?.id ?? null} />
      <InsightsTopNav showBack />

      <main className="container px-4 py-4 max-w-3xl mx-auto">
        <div className="mb-4">
          <Breadcrumbs items={[
            { name: 'Home', url: '/' },
            { name: 'Insights', url: '/insights' },
            ...(article.category ? [{ name: article.category.name, url: `/insights/category/${article.category.slug}` }] : []),
            { name: article.title, url: canonical },
          ]} />
        </div>

        {/* 1. HERO IMAGE */}
        {article.thumbnail_url && (
          <figure className="-mx-4 sm:mx-0 mb-6">
            <img
              src={article.thumbnail_url}
              alt={article.title}
              className="w-full aspect-video object-cover sm:rounded-2xl shadow-md"
            />
          </figure>
        )}

        {/* 2-3. TITLE + META */}
        <header className="space-y-4">
          {article.category && (
            <Link to={`/insights/category/${article.category.slug}`}
              className="inline-block px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wide">
              {article.category.name}
            </Link>
          )}
          <h1 className="text-3xl sm:text-5xl font-extrabold text-foreground leading-[1.15] tracking-tight">{article.title}</h1>
          {(article.meta_description || article.excerpt) && (
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed">
              {article.meta_description || article.excerpt}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap pt-2 border-t border-border/60">
            <span className="flex items-center gap-1.5 pt-3"><Calendar className="h-3.5 w-3.5" />{new Date(publishedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
            <span className="flex items-center gap-1.5 pt-3"><Clock className="h-3.5 w-3.5" />{article.reading_time_min} min read</span>
            <div className="ml-auto pt-3">
              <ShareButtonGroup title={article.title} />
            </div>
          </div>
        </header>

        {/* 4. BODY */}
        <article
          className="insight-prose mt-8"
          dangerouslySetInnerHTML={{ __html: article.body_html || '' }}
        />

        <div className="mt-10 flex items-center gap-2 pt-6 border-t border-border">
          <Button variant={liked ? 'default' : 'outline'} size="sm" onClick={toggleLike} className="gap-1.5">
            <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />{likeCount}
          </Button>
          <Button variant={saved ? 'default' : 'outline'} size="sm" onClick={toggleSave} className="gap-1.5">
            <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />{saved ? 'Saved' : 'Save'}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 ml-auto" onClick={() => document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' })}>
            <MessageCircle className="h-4 w-4" />Comments
          </Button>
        </div>

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold text-foreground mb-4">Continue reading</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {related.slice(0, 6).map((r) => <ArticleCard key={r.id} article={r} />)}
            </div>
          </section>
        )}

        <section id="comments" className="mt-12">
          <CommentsBlock articleId={article.id} />
        </section>
      </main>

      {/* Floating share – mobile bottom-right, desktop sticky middle-right */}
      <div className="fixed z-40 bottom-20 right-4 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:right-6">
        <ShareButtonGroup title={article.title} variant="sticky" />
      </div>
    </div>
  );
};

const ArticleJsonLd = ({ article, url }: { article: any; url: string }) => {
  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const data = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: article.meta_description || article.excerpt || article.title,
      image: article.og_image_url || article.thumbnail_url || undefined,
      datePublished: article.published_at || article.created_at,
      dateModified: article.updated_at,
      keywords: (article.seo_keywords || []).join(', '),
      articleSection: article.category?.name,
      mainEntityOfPage: `${origin}${url}`,
      publisher: { '@type': 'Organization', name: 'P4NO' },
    };
    const s = document.createElement('script');
    s.id = 'insight-article-jsonld';
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(data);
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, [article, url]);
  return null;
};

/* ----- View tracker: inserts a row and updates dwell time on unmount ----- */
const SESSION_KEY = 'p4no_session_id';
const getSessionId = () => {
  try {
    let s = localStorage.getItem(SESSION_KEY);
    if (!s) { s = crypto.randomUUID(); localStorage.setItem(SESSION_KEY, s); }
    return s;
  } catch { return null; }
};

// Public article view counting / dwell analytics are permanently disabled.
// Only local browsing history (device-side) is kept.
const ViewTracker = ({ articleId }: { articleId: string; userId: string | null }) => {
  useEffect(() => {
    if (!articleId) return;
    import('@/hooks/useBrowsingHistory').then(m => m.trackBrowsingHistory('article', articleId));
  }, [articleId]);

  return null;
};

const CommentsBlock = ({ articleId }: { articleId: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [body, setBody] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const load = async () => {
    const { data } = await (supabase as any)
      .from('insight_article_comments')
      .select('*')
      .eq('article_id', articleId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false });
    setComments(data || []);
  };
  useEffect(() => { load(); }, [articleId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast({ title: 'Sign in to comment' }); return; }
    if (!body.trim()) return;
    await (supabase as any).from('insight_article_comments').insert({ article_id: articleId, user_id: user.id, body: body.trim() });
    setBody(''); load();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">Comments ({comments.length})</h2>
      <form onSubmit={submit} className="space-y-2">
        <textarea
          value={body} onChange={(e) => setBody(e.target.value)}
          placeholder={user ? 'Share your thoughts…' : 'Sign in to leave a comment'}
          className="w-full min-h-[80px] rounded-xl border border-border bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Button type="submit" size="sm" disabled={!body.trim()}>Post comment</Button>
      </form>
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="rounded-xl bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground mb-1">{new Date(c.created_at).toLocaleString()}</p>
            <p className="text-sm whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default InsightArticle;