import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, MessageCircle, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Comment {
  id: string;
  product_id: string;
  author_name: string;
  content: string;
  created_at: string;
  is_deleted: boolean;
}

const CommentsModeration = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    fetchComments();
  }, [showDeleted]);

  const fetchComments = async () => {
    try {
      let query = supabase
        .from('product_comments')
        .select('*')
        .order('created_at', { ascending: false });

      if (!showDeleted) {
        query = query.eq('is_deleted', false);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDelete = async (commentId: string, isDeleted: boolean) => {
    try {
      const { error } = await supabase
        .from('product_comments')
        .update({ is_deleted: !isDeleted })
        .eq('id', commentId);

      if (error) throw error;
      
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, is_deleted: !isDeleted } : c));
      toast({ title: isDeleted ? 'Comment restored' : 'Comment deleted' });
    } catch (error: any) {
      toast({ title: 'Failed to update comment', variant: 'destructive' });
    }
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={() => navigate('/admin')}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">Comments Moderation</h1>
            <p className="text-sm text-muted-foreground">{comments.length} comments</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Toggle */}
        <div className="flex items-center gap-3">
          <Button 
            variant={showDeleted ? "default" : "outline"}
            size="sm"
            onClick={() => setShowDeleted(!showDeleted)}
          >
            {showDeleted ? 'Hide Deleted' : 'Show Deleted'}
          </Button>
        </div>

        {/* Comments List */}
        {comments.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-2xl">
            <MessageCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No comments found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <Card key={comment.id} className={comment.is_deleted ? 'opacity-60' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{comment.author_name}</CardTitle>
                      {comment.is_deleted && (
                        <Badge variant="destructive" className="text-xs">Deleted</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">{comment.content}</p>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/product/${comment.product_id}`)}
                    >
                      View Product
                    </Button>
                    <Button 
                      variant={comment.is_deleted ? "secondary" : "destructive"}
                      size="sm"
                      onClick={() => toggleDelete(comment.id, comment.is_deleted)}
                      className="gap-1"
                    >
                      {comment.is_deleted ? (
                        <>
                          <RotateCcw className="h-4 w-4" />
                          Restore
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentsModeration;
