import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Trash2, FolderKanban, Search, Eye, EyeOff, ExternalLink, ArrowLeft, BarChart3, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type StatusFilter = 'all' | 'published' | 'draft' | 'scheduled';
type SortBy = 'updated_desc' | 'updated_asc' | 'published_desc' | 'title_asc';

const AdminInsights = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [catFilter, setCatFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('updated_desc');

  const load = async () => {
    setLoading(true);
    const [{ data: arts }, { data: cats }] = await Promise.all([
      (supabase as any).from('insight_articles').select('*, category:insight_categories(name)').order('updated_at', { ascending: false }),
      (supabase as any).from('insight_categories').select('id, name').order('sort_order'),
    ]);
    setRows(arts || []);
    setCategories(cats || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (statusFilter !== 'all') r = r.filter((x) => x.status === statusFilter);
    if (catFilter) r = r.filter((x) => x.category_id === catFilter);
    if (q.trim()) {
      const needle = q.toLowerCase();
      r = r.filter((x) => (x.title || '').toLowerCase().includes(needle) || (x.slug || '').toLowerCase().includes(needle));
    }
    r.sort((a, b) => {
      switch (sortBy) {
        case 'updated_asc': return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        case 'published_desc': return new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime();
        case 'title_asc': return (a.title || '').localeCompare(b.title || '');
        default: return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });
    return r;
  }, [rows, q, statusFilter, catFilter, sortBy]);

  const remove = async (id: string) => {
    if (!confirm('Delete this article?')) return;
    await (supabase as any).from('insight_articles').delete().eq('id', id);
    toast({ title: 'Article deleted' });
    load();
  };

  const togglePublish = async (r: any) => {
    const next = r.status === 'published' ? 'draft' : 'published';
    const patch: any = { status: next };
    if (next === 'published') patch.published_at = r.published_at || new Date().toISOString();
    await (supabase as any).from('insight_articles').update(patch).eq('id', r.id);
    toast({ title: next === 'published' ? 'Article published' : 'Moved to draft' });
    load();
  };

  const StatusBadge = ({ s }: { s: string }) => {
    const cls = s === 'published'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
      : s === 'scheduled'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
      : 'bg-muted text-muted-foreground';
    return <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${cls}`}>{s}</span>;
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
        <div>
          <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to admin
          </button>
          <h1 className="text-2xl font-bold">P4NO Insights</h1>
          <p className="text-sm text-muted-foreground">Manage articles, categories and editorial content.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/insights/analytics"><Button variant="outline" size="sm" className="gap-1.5"><BarChart3 className="h-4 w-4" />Analytics</Button></Link>
          <Link to="/admin/insights/comments"><Button variant="outline" size="sm" className="gap-1.5"><MessageCircle className="h-4 w-4" />Comments</Button></Link>
          <Link to="/admin/insights/categories"><Button variant="outline" size="sm" className="gap-1.5"><FolderKanban className="h-4 w-4" />Categories</Button></Link>
          <Button onClick={() => navigate('/admin/insights/new')} className="gap-1.5"><Plus className="h-4 w-4" />New article</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-3 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles…" className="pl-9 h-9" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm">
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
          <option value="scheduled">Scheduled</option>
        </select>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm">
          <option value="updated_desc">Recently updated</option>
          <option value="updated_asc">Oldest updated</option>
          <option value="published_desc">Recently published</option>
          <option value="title_asc">Title A–Z</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-3">Title</th>
                <th className="text-left p-3 hidden md:table-cell">Category</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3 hidden md:table-cell">Published</th>
                <th className="text-left p-3 hidden sm:table-cell">Updated</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">
                  {rows.length === 0 ? 'No articles yet — create your first one.' : 'No articles match these filters.'}
                </td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3">
                    <button onClick={() => navigate(`/admin/insights/${r.id}/edit`)} className="text-left font-semibold hover:text-primary line-clamp-2">
                      {r.title || '(untitled)'}
                    </button>
                    <div className="text-[11px] text-muted-foreground mt-0.5">/insights/article/{r.slug}</div>
                  </td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{r.category?.name || '—'}</td>
                  <td className="p-3"><StatusBadge s={r.status} /></td>
                  <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">
                    {r.published_at ? new Date(r.published_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground hidden sm:table-cell">
                    {new Date(r.updated_at).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      {r.status === 'published' && (
                        <a href={`/insights/article/${r.slug}`} target="_blank" rel="noopener noreferrer">
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="View"><ExternalLink className="h-4 w-4" /></Button>
                        </a>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8" title={r.status === 'published' ? 'Unpublish' : 'Publish'} onClick={() => togglePublish(r)}>
                        {r.status === 'published' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit" onClick={() => navigate(`/admin/insights/${r.id}/edit`)}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" title="Delete" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminInsights;