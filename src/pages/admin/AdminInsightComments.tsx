import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2, Eye, EyeOff, ExternalLink, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

type CommentRow = {
  id: string; body: string; created_at: string; is_hidden: boolean;
  article_id: string; user_id: string | null;
  article?: { title: string; slug: string };
  profile?: { display_name: string | null; username: string | null };
};

const AdminInsightComments = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [articleFilter, setArticleFilter] = useState('');
  const [showHidden, setShowHidden] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('insight_article_comments')
      .select('*, article:insight_articles(title, slug)')
      .order('created_at', { ascending: false })
      .limit(500);
    // fetch author profiles in a second pass
    const userIds = Array.from(new Set((data || []).map((r: any) => r.user_id).filter(Boolean)));
    let profileMap: Record<string, any> = {};
    if (userIds.length) {
      const { data: profs } = await (supabase as any)
        .from('profiles').select('id, display_name, username').in('id', userIds);
      profileMap = Object.fromEntries((profs || []).map((p: any) => [p.id, p]));
    }
    setRows(((data as CommentRow[]) || []).map((r) => ({ ...r, profile: r.user_id ? profileMap[r.user_id] : undefined })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const articles = Array.from(new Map(rows.map((r) => [r.article_id, r.article?.title || 'Untitled'])).entries());

  const filtered = rows.filter((r) => {
    if (!showHidden && r.is_hidden) return false;
    if (articleFilter && r.article_id !== articleFilter) return false;
    if (q.trim() && !r.body.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const remove = async (id: string) => {
    if (!confirm('Delete this comment permanently?')) return;
    await (supabase as any).from('insight_article_comments').delete().eq('id', id);
    toast({ title: 'Comment deleted' });
    setRows((r) => r.filter((x) => x.id !== id));
  };
  const toggleHide = async (r: CommentRow) => {
    await (supabase as any).from('insight_article_comments').update({ is_hidden: !r.is_hidden }).eq('id', r.id);
    toast({ title: r.is_hidden ? 'Comment shown' : 'Comment hidden' });
    setRows((rows) => rows.map((x) => x.id === r.id ? { ...x, is_hidden: !r.is_hidden } : x));
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 max-w-5xl mx-auto">
      <Link to="/admin/insights" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Insights
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Article comments</h1>
        <p className="text-sm text-muted-foreground">Moderate comments across all P4NO Insights articles.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-3 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search comment text…" className="pl-9 h-9" />
        </div>
        <select value={articleFilter} onChange={(e) => setArticleFilter(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm">
          <option value="">All articles</option>
          {articles.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-muted-foreground px-2">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          Include hidden
        </label>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-10">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {filtered.length === 0 && (
            <li className="text-center text-muted-foreground py-10 bg-card border border-border rounded-xl">No comments match these filters.</li>
          )}
          {filtered.map((c) => (
            <li key={c.id} className={`bg-card border border-border rounded-xl p-4 ${c.is_hidden ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span className="font-semibold text-foreground">{c.profile?.display_name || c.profile?.username || 'Guest'}</span>
                    <span>·</span>
                    <span>{new Date(c.created_at).toLocaleString()}</span>
                    {c.is_hidden && <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase">Hidden</span>}
                  </div>
                  <p className="text-sm whitespace-pre-wrap mb-2">{c.body}</p>
                  {c.article && (
                    <Link to={`/insights/article/${c.article.slug}`} target="_blank"
                      className="text-[11px] text-primary inline-flex items-center gap-1 hover:underline">
                      <ExternalLink className="h-3 w-3" /> {c.article.title}
                    </Link>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleHide(c)} title={c.is_hidden ? 'Show' : 'Hide'}>
                    {c.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => remove(c.id)} title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminInsightComments;