import { useState, useEffect, useCallback, FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useToast } from '@/hooks/use-toast';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { HelpCircle, Send, Loader2, ThumbsUp, MessageSquare, Trash2, EyeOff, BadgeCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import GuestPromptDialog from '@/components/auth/GuestPromptDialog';
import { useScrollToAnchor } from '@/hooks/useScrollToAnchor';

interface QAProps { productId: string; productSellerId?: string | null }
interface AnswerRow {
  id: string; question_id: string; parent_answer_id: string | null;
  user_id: string; author_name: string; content: string;
  is_seller_reply: boolean; like_count: number; created_at: string;
}
interface QuestionRow {
  id: string; user_id: string; author_name: string; content: string;
  like_count: number; answer_count: number; created_at: string;
  answers: AnswerRow[];
}

const ProductQA = ({ productId, productSellerId }: QAProps) => {
  const { user, profile } = useAuth();
  const { isAdmin } = useAdmin();
  const { toast } = useToast();
  const { requireAuth, promptOpen, setPromptOpen } = useRequireAuth();

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAskForm, setShowAskForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [replyTo, setReplyTo] = useState<{ questionId: string; parentAnswerId?: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(5);
  const [totalCount, setTotalCount] = useState(0);

  const authorName = profile?.full_name || user?.email?.split('@')[0] || 'User';

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: qs, error: qErr, count } = await supabase
        .from('product_questions')
        .select('id,user_id,author_name,content,like_count,answer_count,created_at', { count: 'exact' })
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(visibleCount);
      if (qErr) throw qErr;
      setTotalCount(count || 0);
      const qIds = (qs || []).map((q: any) => q.id);
      let answers: AnswerRow[] = [];
      if (qIds.length) {
        const { data: aData } = await supabase
          .from('product_answers')
          .select('id,question_id,parent_answer_id,user_id,author_name,content,is_seller_reply,like_count,created_at')
          .in('question_id', qIds)
          .order('created_at', { ascending: true });
        answers = (aData as AnswerRow[]) || [];
      }
      const grouped: QuestionRow[] = (qs || []).map((q: any) => ({
        ...q,
        answers: answers.filter((a) => a.question_id === q.id),
      }));
      setQuestions(grouped);

      if (user && (qIds.length || answers.length)) {
        const ids = [...qIds, ...answers.map(a => a.id)];
        const { data: likes } = await supabase
          .from('product_qa_likes')
          .select('target_id')
          .eq('user_id', user.id)
          .in('target_id', ids);
        setLikedSet(new Set((likes || []).map((l: any) => l.target_id)));
      } else {
        setLikedSet(new Set());
      }
    } catch (e) {
      console.error('qa fetch', e);
    } finally {
      setLoading(false);
    }
  }, [productId, user, visibleCount]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useScrollToAnchor(!loading && questions.length > 0);

  const openAsk = () => requireAuth(() => setShowAskForm(true));

  const submitQuestion = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) { setPromptOpen(true); return; }
    const content = newQuestion.trim();
    if (content.length < 5) { toast({ title: 'Question too short', variant: 'destructive' }); return; }
    setSubmitting(true);
    const { error } = await supabase.from('product_questions').insert({
      product_id: productId, user_id: user.id, author_name: authorName, content,
    });
    setSubmitting(false);
    if (error) { toast({ title: 'Failed to post', description: error.message, variant: 'destructive' }); return; }
    setNewQuestion(''); setShowAskForm(false); toast({ title: 'Question posted!' }); fetchAll();
  };

  const submitReply = async (questionId: string, parentAnswerId?: string) => {
    if (!user) { setPromptOpen(true); return; }
    const content = replyText.trim();
    if (content.length < 2) { toast({ title: 'Reply too short', variant: 'destructive' }); return; }
    const { error } = await supabase.from('product_answers').insert({
      question_id: questionId,
      parent_answer_id: parentAnswerId || null,
      user_id: user.id, author_name: authorName, content,
    });
    if (error) { toast({ title: 'Failed to reply', description: error.message, variant: 'destructive' }); return; }
    // Push: notify the question's asker (or the parent answer's author for nested replies)
    try {
      let targetUserId: string | null = null;
      if (parentAnswerId) {
        const { data } = await supabase
          .from('product_answers')
          .select('user_id')
          .eq('id', parentAnswerId)
          .maybeSingle();
        targetUserId = data?.user_id || null;
      } else {
        const { data } = await supabase
          .from('product_questions')
          .select('user_id')
          .eq('id', questionId)
          .maybeSingle();
        targetUserId = data?.user_id || null;
      }
      if (targetUserId && targetUserId !== user.id) {
        const { notifyEvent } = await import('@/lib/notifyEvent');
        notifyEvent({
          type: 'qa_reply',
          target_user_id: targetUserId,
          url: window.location.pathname,
        });
      }
    } catch {}
    setReplyText(''); setReplyTo(null); fetchAll();
  };

  const toggleLike = async (targetType: 'question' | 'answer', targetId: string) => {
    if (!user) { setPromptOpen(true); return; }
    const liked = likedSet.has(targetId);
    if (liked) {
      await supabase.from('product_qa_likes').delete()
        .eq('user_id', user.id).eq('target_type', targetType).eq('target_id', targetId);
    } else {
      await supabase.from('product_qa_likes').insert({
        user_id: user.id, target_type: targetType, target_id: targetId,
      });
    }
    fetchAll();
  };

  const removeItem = async (kind: 'question' | 'answer', id: string) => {
    if (!confirm('Delete this?')) return;
    const table = kind === 'question' ? 'product_questions' : 'product_answers';
    const { error } = await supabase.from(table).update({ is_deleted: true } as any).eq('id', id);
    if (error) { toast({ title: 'Delete failed', description: error.message, variant: 'destructive' }); return; }
    fetchAll();
  };

  const hideItem = async (kind: 'question' | 'answer', id: string) => {
    const table = kind === 'question' ? 'product_questions' : 'product_answers';
    const { error } = await supabase.from(table).update({ is_hidden: true } as any).eq('id', id);
    if (error) { toast({ title: 'Hide failed', description: error.message, variant: 'destructive' }); return; }
    fetchAll();
  };

  const renderAnswer = (a: AnswerRow, depth = 0) => {
    const liked = likedSet.has(a.id);
    const children = questions
      .find((q) => q.id === a.question_id)?.answers
      .filter((c) => c.parent_answer_id === a.id) || [];
    const isOwner = user?.id === a.user_id;
    return (
      <div
        key={a.id}
        id={`answer-${a.id}`}
        data-anchor-id={`answer-${a.id}`}
        className={`pl-${Math.min(depth * 3, 9)} mt-3`}
      >
        <div className="flex items-start gap-2">
          <Avatar className="h-7 w-7"><AvatarFallback className="bg-primary/10 text-primary text-xs">{a.author_name.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{a.author_name}</span>
              {a.is_seller_reply && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                  <BadgeCheck className="h-3 w-3" />Seller
                </span>
              )}
              <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{a.content}</p>
            <div className="flex items-center gap-3 mt-1.5 text-xs">
              <button onClick={() => toggleLike('answer', a.id)} className={`inline-flex items-center gap-1 hover:text-primary ${liked ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                <ThumbsUp className="h-3.5 w-3.5" /> {a.like_count}
              </button>
              <button onClick={() => { setReplyTo({ questionId: a.question_id, parentAnswerId: a.id }); setReplyText(''); }} className="text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" /> Reply
              </button>
              {(isOwner || isAdmin) && (
                <button onClick={() => removeItem('answer', a.id)} className="text-muted-foreground hover:text-destructive inline-flex items-center gap-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              {isAdmin && !isOwner && (
                <button onClick={() => hideItem('answer', a.id)} className="text-muted-foreground hover:text-destructive inline-flex items-center gap-1" title="Hide">
                  <EyeOff className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {replyTo?.parentAnswerId === a.id && (
              <div className="mt-2 space-y-2">
                <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={2} placeholder={`Reply to ${a.author_name}...`} />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>Cancel</Button>
                  <Button size="sm" onClick={() => submitReply(a.question_id, a.id)} className="bg-primary text-primary-foreground"><Send className="h-3.5 w-3.5 mr-1" />Reply</Button>
                </div>
              </div>
            )}
            {children.map((c) => renderAnswer(c, depth + 1))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          Questions & Answers ({totalCount || questions.length})
        </h3>
        {!showAskForm && (
          <Button size="sm" onClick={openAsk} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1">
            <HelpCircle className="h-3.5 w-3.5" />Ask a question
          </Button>
        )}
      </div>

      {showAskForm && user && (
        <form onSubmit={submitQuestion} className="bg-muted/50 rounded-xl p-4 space-y-3">
          <Textarea placeholder="Ask anything about this product..." value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} rows={3} className="bg-background resize-none" />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAskForm(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={submitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}Post Question
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : questions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <HelpCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No questions yet. Be the first to ask!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => {
            const liked = likedSet.has(q.id);
            const isOwner = user?.id === q.user_id;
            const topAnswers = q.answers.filter((a) => !a.parent_answer_id);
            return (
              <div
                key={q.id}
                id={`question-${q.id}`}
                data-anchor-id={`question-${q.id}`}
                className="bg-card border rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-primary text-xs">{q.author_name.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm">{q.author_name}</span>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(q.created_at), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap font-medium">Q: {q.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <button onClick={() => toggleLike('question', q.id)} className={`inline-flex items-center gap-1 hover:text-primary ${liked ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                        <ThumbsUp className="h-3.5 w-3.5" /> {q.like_count}
                      </button>
                      <button onClick={() => { setReplyTo({ questionId: q.id }); setReplyText(''); }} className="text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" /> {q.answer_count} {q.answer_count === 1 ? 'answer' : 'answers'} · Reply
                      </button>
                      {(isOwner || isAdmin) && (
                        <button onClick={() => removeItem('question', q.id)} className="text-muted-foreground hover:text-destructive inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                      {isAdmin && !isOwner && (
                        <button onClick={() => hideItem('question', q.id)} className="text-muted-foreground hover:text-destructive"><EyeOff className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                    {replyTo?.questionId === q.id && !replyTo.parentAnswerId && (
                      <div className="mt-3 space-y-2">
                        <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={2} placeholder="Write your answer..." />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>Cancel</Button>
                          <Button size="sm" onClick={() => submitReply(q.id)} className="bg-primary text-primary-foreground"><Send className="h-3.5 w-3.5 mr-1" />Post</Button>
                        </div>
                      </div>
                    )}
                    {topAnswers.length > 0 && (
                      <div className="mt-3 border-l-2 border-primary/20 pl-3">
                        {topAnswers.map((a) => renderAnswer(a))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && questions.length < totalCount && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={() => setVisibleCount((n) => n + 10)}>
            Load more questions ({totalCount - questions.length} remaining)
          </Button>
        </div>
      )}

      <GuestPromptDialog open={promptOpen} onOpenChange={setPromptOpen}
        title="Sign in to join the discussion"
        description="Create a free P4NO account to ask and answer product questions." />
    </div>
  );
};

export default ProductQA;