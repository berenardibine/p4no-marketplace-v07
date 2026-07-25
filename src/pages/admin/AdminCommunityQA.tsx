import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, EyeOff, Eye, Trash2, ExternalLink } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface Q {
  id: string; product_id: string; user_id: string; author_name: string;
  content: string; is_hidden: boolean; is_deleted: boolean;
  answer_count: number; like_count: number; created_at: string;
  products?: { title: string; slug: string | null } | null;
}
interface A {
  id: string; question_id: string; user_id: string; author_name: string;
  content: string; is_hidden: boolean; is_deleted: boolean;
  like_count: number; is_seller_reply: boolean; created_at: string;
}

export default function AdminCommunityQA() {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();
  const [tab, setTab] = useState<'all' | 'unanswered' | 'hidden' | 'answers'>('all');
  const [search, setSearch] = useState('');
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<A[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    if (tab === 'answers') {
      let q = supabase.from('product_answers')
        .select('id,question_id,user_id,author_name,content,is_hidden,is_deleted,like_count,is_seller_reply,created_at')
        .order('created_at', { ascending: false }).limit(200);
      if (search) q = q.ilike('content', `%${search}%`);
      const { data } = await q;
      setAnswers((data as A[]) || []);
    } else {
      let q = supabase.from('product_questions')
        .select('id,product_id,user_id,author_name,content,is_hidden,is_deleted,answer_count,like_count,created_at,products(title,slug)')
        .order('created_at', { ascending: false }).limit(200);
      if (tab === 'unanswered') q = q.eq('answer_count', 0).eq('is_deleted', false);
      else if (tab === 'hidden') q = q.eq('is_hidden', true);
      else q = q.eq('is_deleted', false);
      if (search) q = q.ilike('content', `%${search}%`);
      const { data } = await q;
      setQuestions((data as any) || []);
    }
    setLoading(false);
  }, [tab, search]);

  useEffect(() => { if (isAdmin) fetchData(); }, [fetchData, isAdmin]);

  if (adminLoading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const toggleHide = async (kind: 'q' | 'a', id: string, value: boolean) => {
    const table = kind === 'q' ? 'product_questions' : 'product_answers';
    const { error } = await supabase.from(table).update({ is_hidden: value } as any).eq('id', id);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else fetchData();
  };
  const remove = async (kind: 'q' | 'a', id: string) => {
    if (!confirm('Delete (soft) this item?')) return;
    const table = kind === 'q' ? 'product_questions' : 'product_answers';
    const { error } = await supabase.from(table).update({ is_deleted: true } as any).eq('id', id);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else fetchData();
  };

  return (
    <div className="container max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Community Q&A</h1>
        <Button asChild variant="outline" size="sm"><Link to="/admin">Back</Link></Button>
      </div>
      <Input placeholder="Search content..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All Questions</TabsTrigger>
          <TabsTrigger value="unanswered">Unanswered</TabsTrigger>
          <TabsTrigger value="hidden">Hidden</TabsTrigger>
          <TabsTrigger value="answers">All Answers</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          {loading ? <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> :
            tab === 'answers' ? (
              <div className="space-y-2">
                {answers.length === 0 && <p className="text-muted-foreground text-center py-8">No answers found.</p>}
                {answers.map((a) => (
                  <div key={a.id} className="border rounded-lg p-3 bg-card">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span className="font-semibold text-foreground">{a.author_name}</span>
                      {a.is_seller_reply && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">Seller</span>}
                      {a.is_hidden && <span className="bg-yellow-500/10 text-yellow-700 px-1.5 py-0.5 rounded">Hidden</span>}
                      {a.is_deleted && <span className="bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Deleted</span>}
                      <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm">{a.content}</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" onClick={() => toggleHide('a', a.id, !a.is_hidden)}>
                        {a.is_hidden ? <Eye className="h-3.5 w-3.5 mr-1" /> : <EyeOff className="h-3.5 w-3.5 mr-1" />}
                        {a.is_hidden ? 'Unhide' : 'Hide'}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => remove('a', a.id)}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {questions.length === 0 && <p className="text-muted-foreground text-center py-8">No questions found.</p>}
                {questions.map((q) => (
                  <div key={q.id} className="border rounded-lg p-3 bg-card">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 flex-wrap">
                      <span className="font-semibold text-foreground">{q.author_name}</span>
                      {q.is_hidden && <span className="bg-yellow-500/10 text-yellow-700 px-1.5 py-0.5 rounded">Hidden</span>}
                      <span>·</span>
                      <span>{q.answer_count} answer(s) · {q.like_count} like(s)</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(q.created_at), { addSuffix: true })}</span>
                      {q.products && (
                        <Link to={`/product/${q.products.slug || q.product_id}#qa-${q.id}`} className="ml-auto inline-flex items-center gap-1 text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" />{q.products.title}
                        </Link>
                      )}
                    </div>
                    <p className="text-sm">{q.content}</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" onClick={() => toggleHide('q', q.id, !q.is_hidden)}>
                        {q.is_hidden ? <Eye className="h-3.5 w-3.5 mr-1" /> : <EyeOff className="h-3.5 w-3.5 mr-1" />}
                        {q.is_hidden ? 'Unhide' : 'Hide'}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => remove('q', q.id)}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </TabsContent>
      </Tabs>
    </div>
  );
}