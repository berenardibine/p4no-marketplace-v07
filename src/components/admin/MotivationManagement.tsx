import { useState, useEffect } from "react";
import { 
  Quote, Plus, Edit, Trash2, Calendar, User, MoreVertical, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Motivation {
  id: string;
  quote: string;
  author: string | null;
  category: string | null;
  created_at: string;
}

const MotivationManagement = () => {
  const { toast } = useToast();
  const [motivations, setMotivations] = useState<Motivation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingMotivation, setEditingMotivation] = useState<Motivation | null>(null);
  const [formData, setFormData] = useState({ quote: '', author: '', category: '' });

  const fetchMotivations = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('daily_motivations')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setMotivations(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchMotivations();
  }, []);

  const handleSubmit = async () => {
    if (!formData.quote.trim()) {
      toast({ title: "Quote is required", variant: "destructive" });
      return;
    }

    if (editingMotivation) {
      const { error } = await (supabase as any)
        .from('daily_motivations')
        .update({
          quote: formData.quote,
          author: formData.author || null,
          category: formData.category || null,
        })
        .eq('id', editingMotivation.id);

      if (error) {
        toast({ title: "Failed to update", variant: "destructive" });
      } else {
        toast({ title: "Motivation updated!" });
        fetchMotivations();
      }
    } else {
      const { error } = await (supabase as any)
        .from('daily_motivations')
        .insert({
          quote: formData.quote,
          author: formData.author || null,
          category: formData.category || null,
        });

      if (error) {
        toast({ title: "Failed to add", variant: "destructive" });
      } else {
        toast({ title: "Motivation added!" });
        fetchMotivations();
      }
    }

    setFormData({ quote: '', author: '', category: '' });
    setEditingMotivation(null);
    setShowAddDialog(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this motivation?')) return;
    
    const { error } = await (supabase as any)
      .from('daily_motivations')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: "Failed to delete", variant: "destructive" });
    } else {
      toast({ title: "Deleted!" });
      fetchMotivations();
    }
  };

  const openEditDialog = (motivation: Motivation) => {
    setEditingMotivation(motivation);
    setFormData({
      quote: motivation.quote,
      author: motivation.author || '',
      category: motivation.category || '',
    });
    setShowAddDialog(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Daily Motivations</h3>
          <p className="text-sm text-muted-foreground">
            Manage inspirational quotes shown to users
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Add Quote
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>
                {editingMotivation ? 'Edit Motivation' : 'Add New Motivation'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Quote *</label>
                <Textarea
                  placeholder="Enter the motivational quote..."
                  value={formData.quote}
                  onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Author</label>
                <Input
                  placeholder="e.g., Steve Jobs"
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Input
                  placeholder="e.g., Business, Life, Success"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingMotivation ? 'Update' : 'Add Motivation'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <Quote className="h-4 w-4" />
            <span className="text-xs font-medium">Total Quotes</span>
          </div>
          <p className="text-2xl font-bold">{motivations.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-orange-600 mb-1">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-medium">Active Today</span>
          </div>
          <p className="text-2xl font-bold">1</p>
        </div>
      </div>

      {/* Motivation List */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-white">
          <h3 className="font-semibold">All Motivations</h3>
        </div>
        <div className="divide-y max-h-[500px] overflow-y-auto">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="p-4">
                <Skeleton className="h-20" />
              </div>
            ))
          ) : motivations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Quote className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No motivations yet. Add your first quote!</p>
            </div>
          ) : (
            motivations.map(motivation => (
              <div key={motivation.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <Quote className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-relaxed">
                      "{motivation.quote}"
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {motivation.author && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {motivation.author}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(motivation.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white">
                      <DropdownMenuItem onClick={() => openEditDialog(motivation)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(motivation.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MotivationManagement;
