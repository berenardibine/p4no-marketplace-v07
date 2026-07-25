import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageCircle, Send, Loader2, Pencil, Trash2, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import GuestPromptDialog from '@/components/auth/GuestPromptDialog';
import { useScrollToAnchor } from '@/hooks/useScrollToAnchor';

interface Comment {
  id: string;
  user_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
}

interface ProductCommentsProps {
  productId: string;
}

const ProductComments = ({ productId }: ProductCommentsProps) => {
  const { user, profile } = useAuth();
  const { isAdmin } = useAdmin();
  const { toast } = useToast();
  const { requireAuth, promptOpen, setPromptOpen } = useRequireAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const fetchComments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('product_comments')
        .select('id, user_id, author_name, content, created_at')
        .eq('product_id', productId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setComments(data || []);
    } catch (e) {
      console.error('fetch comments', e);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);
  useScrollToAnchor(!loading && comments.length > 0);

  const openForm = () => requireAuth(() => setShowForm(true));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newComment.trim();
    if (content.length < 5) {
      toast({ title: 'Comment must be at least 5 characters', variant: 'destructive' });
      return;
    }
    if (!user) { setPromptOpen(true); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('product_comments').insert({
        product_id: productId,
        user_id: user.id,
        author_name: profile?.full_name || user.email?.split('@')[0] || 'User',
        content,
      });
      if (error) throw error;
      // Push: notify the product owner
      try {
        const { data: prod } = await supabase
          .from('products')
          .select('seller_id')
          .eq('id', productId)
          .maybeSingle();
        if (prod?.seller_id && prod.seller_id !== user.id) {
          const { notifyEvent } = await import('@/lib/notifyEvent');
          notifyEvent({
            type: 'comment',
            target_user_id: prod.seller_id,
            url: window.location.pathname,
          });
        }
      } catch {}
      setNewComment('');
      setShowForm(false);
      fetchComments();
      toast({ title: 'Comment posted!' });
    } catch (err: any) {
      toast({ title: 'Failed to post comment', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (c: Comment) => {
    setEditingId(c.id);
    setEditContent(c.content);
  };

  const saveEdit = async (id: string) => {
    const content = editContent.trim();
    if (content.length < 5) {
      toast({ title: 'Comment too short', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('product_comments').update({ content }).eq('id', id);
    if (error) {
      toast({ title: 'Failed to edit', description: error.message, variant: 'destructive' });
      return;
    }
    setEditingId(null);
    fetchComments();
  };

  const deleteComment = async (id: string) => {
    if (!confirm('Delete this comment?')) return;
    const { error } = await supabase.from('product_comments').update({ is_deleted: true }).eq('id', id);
    if (error) {
      toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' });
      return;
    }
    fetchComments();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-blue-600" />
          Comments ({comments.length})
        </h3>
        {!showForm && (
          <Button size="sm" onClick={openForm} className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            Add Comment
          </Button>
        )}
      </div>

      {showForm && user && (
        <form onSubmit={handleSubmit} className="bg-muted/50 rounded-xl p-4 space-y-3">
          <Textarea
            placeholder="Share your thoughts about this product..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            className="bg-background resize-none"
          />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Post
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No comments yet. Be the first to share your thoughts!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => {
            const isOwner = !!user && c.user_id === user.id;
            const canEdit = isOwner;
            const canDelete = isOwner || isAdmin;
            return (
              <div
                key={c.id}
                id={`comment-${c.id}`}
                data-anchor-id={`comment-${c.id}`}
                className="bg-card border rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {c.author_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{c.author_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {editingId === c.id ? (
                      <div className="space-y-2">
                        <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={2} />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                          <Button size="sm" onClick={() => saveEdit(c.id)} className="bg-blue-600 hover:bg-blue-700 text-white"><Check className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground">{c.content}</p>
                    )}
                  </div>
                  {editingId !== c.id && (canEdit || canDelete) && (
                    <div className="flex gap-1 shrink-0">
                      {canEdit && (
                        <button onClick={() => startEdit(c)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" aria-label="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => deleteComment(c.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive" aria-label="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <GuestPromptDialog
        open={promptOpen}
        onOpenChange={setPromptOpen}
        title="Sign in to comment"
        description="Create your free P4NO account to interact with sellers and products."
      />
    </div>
  );
};

export default ProductComments;
