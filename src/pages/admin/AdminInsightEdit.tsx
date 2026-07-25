import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import RichEditor from '@/components/admin/insights/RichEditor';
import { ArrowLeft, CloudUpload, Check, Loader2, Globe, EyeOff, Trash2 } from 'lucide-react';

const slugify = (s: string) =>
  s.toLowerCase().trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

const estimateReadingTime = (html: string) =>
  Math.max(1, Math.round(html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 220));

const firstImageFromHtml = (html: string): string | null => {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1] || null;
};

type Status = 'draft' | 'published';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const AdminInsightEdit = () => {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [id, setId] = useState<string | undefined>(routeId);
  const [categories, setCategories] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [bodyJson, setBodyJson] = useState<any>(null);
  const [status, setStatus] = useState<Status>('draft');
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [slug, setSlug] = useState<string>('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [loaded, setLoaded] = useState(!routeId);
  const lastPayload = useRef<string>('');
  const autosaveTimer = useRef<any>(null);

  // Load article + categories
  useEffect(() => {
    (async () => {
      const { data: cats } = await (supabase as any)
        .from('insight_categories').select('*').order('sort_order');
      setCategories(cats || []);
      if (routeId) {
        const { data } = await (supabase as any)
          .from('insight_articles').select('*').eq('id', routeId).maybeSingle();
        if (data) {
          setTitle(data.title || '');
          setMetaDescription(data.meta_description || data.excerpt || '');
          setCategoryId(data.category_id || '');
          setBodyHtml(data.body_html || '');
          setBodyJson(data.body || null);
          setStatus(data.status === 'published' ? 'published' : 'draft');
          setPublishedAt(data.published_at);
          setSlug(data.slug || '');
        }
      }
      setLoaded(true);
    })();
  }, [routeId]);

  const buildPayload = () => {
    const firstImg = firstImageFromHtml(bodyHtml || '');
    const baseSlug = slug || slugify(title);
    return {
      title: title.trim(),
      slug: baseSlug,
      excerpt: metaDescription || null,
      meta_title: title.trim() || null,
      meta_description: metaDescription || null,
      body: bodyJson,
      body_html: bodyHtml,
      thumbnail_url: firstImg,
      og_image_url: firstImg,
      category_id: categoryId || null,
      author_id: user?.id || null,
      status,
      published_at:
        status === 'published' ? (publishedAt || new Date().toISOString()) : publishedAt,
      reading_time_min: estimateReadingTime(bodyHtml || ''),
      seo_keywords: [],
      tags: [],
    };
  };

  // Autosave (debounced) — only when there's a title and content has changed
  useEffect(() => {
    if (!loaded) return;
    if (!title.trim()) return;
    const payload = buildPayload();
    const key = JSON.stringify(payload);
    if (key === lastPayload.current) return;

    setSaveState('saving');
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      try {
        if (id) {
          const { error } = await (supabase as any).from('insight_articles').update(payload).eq('id', id);
          if (error) throw error;
        } else {
          const { data, error } = await (supabase as any)
            .from('insight_articles').insert(payload).select('id, slug').single();
          if (error) throw error;
          setId(data.id);
          setSlug(data.slug);
          window.history.replaceState({}, '', `/admin/insights/${data.id}/edit`);
        }
        lastPayload.current = key;
        setSaveState('saved');
      } catch (e: any) {
        setSaveState('error');
        console.error('Autosave failed', e);
      }
    }, 900);
    return () => clearTimeout(autosaveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, metaDescription, categoryId, bodyHtml, bodyJson, status, loaded]);

  const publish = async () => {
    if (!title.trim()) { toast({ title: 'Add a title first', variant: 'destructive' }); return; }
    setStatus('published');
    const payload = { ...buildPayload(), status: 'published', published_at: publishedAt || new Date().toISOString() };
    setSaveState('saving');
    if (id) {
      const { error } = await (supabase as any).from('insight_articles').update(payload).eq('id', id);
      if (error) { toast({ title: 'Publish failed', description: error.message, variant: 'destructive' }); setSaveState('error'); return; }
    } else {
      const { data, error } = await (supabase as any).from('insight_articles').insert(payload).select('id, slug').single();
      if (error) { toast({ title: 'Publish failed', description: error.message, variant: 'destructive' }); setSaveState('error'); return; }
      setId(data.id); setSlug(data.slug);
    }
    setPublishedAt(payload.published_at);
    setSaveState('saved');
    toast({ title: '🚀 Article published' });
  };

  const unpublish = async () => {
    if (!id) return;
    await (supabase as any).from('insight_articles').update({ status: 'draft' }).eq('id', id);
    setStatus('draft');
    toast({ title: 'Moved to draft' });
  };

  const remove = async () => {
    if (!id) { navigate('/admin/insights'); return; }
    if (!confirm('Delete this article? This cannot be undone.')) return;
    await (supabase as any).from('insight_articles').delete().eq('id', id);
    toast({ title: 'Article deleted' });
    navigate('/admin/insights');
  };

  const SaveBadge = useMemo(() => {
    const map = {
      idle: { icon: <CloudUpload className="h-3.5 w-3.5" />, label: 'Draft', cls: 'text-muted-foreground' },
      saving: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, label: 'Saving…', cls: 'text-amber-600' },
      saved: { icon: <Check className="h-3.5 w-3.5" />, label: 'Draft saved', cls: 'text-emerald-600' },
      error: { icon: <CloudUpload className="h-3.5 w-3.5" />, label: 'Save failed', cls: 'text-red-600' },
    } as const;
    const s = map[saveState];
    return <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${s.cls}`}>{s.icon}{s.label}</span>;
  }, [saveState]);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate('/admin/insights')} className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="ml-2 flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
              {status === 'published' ? 'Published' : 'Draft'}
            </span>
            {SaveBadge}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={remove} className="text-red-600 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
            </Button>
            {status === 'published' ? (
              <Button size="sm" variant="outline" onClick={unpublish} className="gap-1.5">
                <EyeOff className="h-4 w-4" /> Unpublish
              </Button>
            ) : null}
            <Button size="sm" onClick={publish} className="gap-1.5 bg-primary">
              <Globe className="h-4 w-4" />{status === 'published' ? 'Update' : 'Publish'}
            </Button>
          </div>
        </div>
      </header>

      {/* Article meta */}
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-4 space-y-4">
        <select
          value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
          className="text-xs font-bold uppercase tracking-wide bg-primary/10 text-primary px-3 py-1.5 rounded-full border-none focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
        >
          <option value="">Choose category…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Article title"
          className="text-3xl sm:text-4xl font-extrabold border-0 px-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40 h-auto py-2"
        />
        <Textarea
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          placeholder="Short meta description for SEO and social previews (max 160 chars)"
          maxLength={200}
          rows={2}
          className="border-0 px-0 shadow-none focus-visible:ring-0 resize-none text-base text-muted-foreground placeholder:text-muted-foreground/40"
        />
        <p className="text-[11px] text-muted-foreground">
          The first image in the body is used as the article thumbnail and social preview automatically.
        </p>
      </div>

      {/* Editor */}
      <div className="max-w-5xl mx-auto px-4 pb-12">
        <RichEditor
          initialHtml={bodyHtml}
          productName={title}
          onChange={(html, json) => { setBodyHtml(html); setBodyJson(json); }}
        />

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
          <div className="text-xs text-muted-foreground">
            {slug ? <>URL: <code className="bg-muted px-1.5 py-0.5 rounded">/insights/article/{slug}</code></> : 'URL is generated from title once saved.'}
          </div>
          <Button size="lg" onClick={publish} className="gap-2 text-base px-8 shadow-lg shadow-primary/20">
            <Globe className="h-5 w-5" /> {status === 'published' ? 'Update article' : 'Publish article'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminInsightEdit;