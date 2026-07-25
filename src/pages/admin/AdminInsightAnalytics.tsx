import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Eye, Clock, TrendingUp, FileText } from 'lucide-react';

type ArticleRow = { id: string; title: string; slug: string; published_at: string | null };
type ViewRow = { article_id: string; user_id: string | null; dwell_ms: number; created_at: string };

const fmtMs = (ms: number) => {
  if (!ms || ms < 1000) return '<1s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
};

const AdminInsightAnalytics = () => {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [views, setViews] = useState<ViewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'7d' | '30d' | 'all'>('30d');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = range === 'all' ? null : new Date(Date.now() - (range === '7d' ? 7 : 30) * 86400_000).toISOString();
      let q = (supabase as any).from('insight_article_views').select('article_id, user_id, dwell_ms, created_at').order('created_at', { ascending: false }).limit(5000);
      if (since) q = q.gte('created_at', since);
      const [{ data: v }, { data: a }] = await Promise.all([
        q,
        (supabase as any).from('insight_articles').select('id, title, slug, published_at'),
      ]);
      setViews(v || []);
      setArticles(a || []);
      setLoading(false);
    })();
  }, [range]);

  const totalViews = views.length;
  const uniqueReaders = new Set(views.map((v) => v.user_id || `s:${v.article_id}`)).size;
  const totalDwellMs = views.reduce((s, v) => s + (v.dwell_ms || 0), 0);
  const avgDwellMs = totalViews ? Math.round(totalDwellMs / totalViews) : 0;

  // by article
  const byArticle = new Map<string, { views: number; dwell: number }>();
  views.forEach((v) => {
    const cur = byArticle.get(v.article_id) || { views: 0, dwell: 0 };
    cur.views += 1;
    cur.dwell += v.dwell_ms || 0;
    byArticle.set(v.article_id, cur);
  });
  const top = articles
    .map((a) => ({ ...a, ...(byArticle.get(a.id) || { views: 0, dwell: 0 }) }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 15);

  // daily series
  const days: Record<string, number> = {};
  views.forEach((v) => {
    const d = new Date(v.created_at).toISOString().slice(0, 10);
    days[d] = (days[d] || 0) + 1;
  });
  const series = Object.entries(days).sort(([a], [b]) => a.localeCompare(b)).slice(-30);
  const maxDay = Math.max(1, ...series.map(([, n]) => n));

  const Card = ({ icon: Icon, label, value, hint }: any) => (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="text-3xl font-extrabold mt-1.5">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 max-w-6xl mx-auto">
      <Link to="/admin/insights" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Insights
      </Link>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Insights Analytics</h1>
          <p className="text-sm text-muted-foreground">Views, readers, and reading time across all articles.</p>
        </div>
        <select value={range} onChange={(e) => setRange(e.target.value as any)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm">
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-10">Loading analytics…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Card icon={Eye} label="Total views" value={totalViews.toLocaleString()} hint="Including guests" />
            <Card icon={TrendingUp} label="Unique readers" value={uniqueReaders.toLocaleString()} hint="Users + sessions" />
            <Card icon={Clock} label="Avg. reading time" value={fmtMs(avgDwellMs)} hint="Per visit" />
            <Card icon={FileText} label="Total reading time" value={fmtMs(totalDwellMs)} hint="Combined across all visits" />
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 mb-6">
            <h2 className="text-sm font-bold mb-3">Views over time</h2>
            {series.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data yet.</p>
            ) : (
              <div className="flex items-end gap-1 h-32">
                {series.map(([d, n]) => (
                  <div key={d} className="flex-1 flex flex-col items-center gap-1" title={`${d}: ${n} views`}>
                    <div className="w-full bg-primary/80 rounded-t" style={{ height: `${(n / maxDay) * 100}%`, minHeight: 2 }} />
                    <span className="text-[9px] text-muted-foreground">{d.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <h2 className="text-sm font-bold p-4 border-b border-border">Top articles</h2>
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Article</th>
                  <th className="text-right p-3">Views</th>
                  <th className="text-right p-3 hidden sm:table-cell">Reading time</th>
                  <th className="text-right p-3 hidden sm:table-cell">Avg/visit</th>
                </tr>
              </thead>
              <tbody>
                {top.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="p-3">
                      <Link to={`/insights/article/${a.slug}`} target="_blank" className="font-semibold hover:text-primary">{a.title}</Link>
                    </td>
                    <td className="p-3 text-right font-bold">{a.views}</td>
                    <td className="p-3 text-right text-muted-foreground hidden sm:table-cell">{fmtMs(a.dwell)}</td>
                    <td className="p-3 text-right text-muted-foreground hidden sm:table-cell">{fmtMs(a.views ? a.dwell / a.views : 0)}</td>
                  </tr>
                ))}
                {top.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No views recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminInsightAnalytics;