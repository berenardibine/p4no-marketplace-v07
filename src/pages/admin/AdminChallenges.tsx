import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Plus, Trash2, Edit, Trophy, Target, 
  Zap, Star, Gift, Users, Clock, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdmin } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const iconOptions = [
  { value: "trophy", label: "Trophy", icon: Trophy },
  { value: "target", label: "Target", icon: Target },
  { value: "zap", label: "Zap", icon: Zap },
  { value: "star", label: "Star", icon: Star },
  { value: "gift", label: "Gift", icon: Gift },
  { value: "users", label: "Users", icon: Users },
];

const categoryOptions = ["general", "selling", "engagement", "social", "daily", "weekly"];

const AdminChallenges = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/');
      return;
    }
    fetchTasks();
  }, [isAdmin, adminLoading]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reward_tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingTask?.title || !editingTask?.description) {
      toast({ title: "Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: editingTask.title,
        description: editingTask.description,
        reward_points: editingTask.reward_points || 50,
        reward_coins: editingTask.reward_coins || 10,
        task_type: editingTask.task_type || 'action',
        requirement_count: editingTask.requirement_count || 1,
        icon: editingTask.icon || 'trophy',
        color: editingTask.color || '#f97316',
        expires_at: editingTask.expires_at,
        is_active: editingTask.is_active ?? true,
        category: editingTask.category || 'general',
        requires_evidence: editingTask.requires_evidence || false,
      };

      if (editingTask.id) {
        const { error } = await supabase.from('reward_tasks').update(payload).eq('id', editingTask.id);
        if (error) throw error;
        toast({ title: "Task updated successfully!" });
      } else {
        const { error } = await supabase.from('reward_tasks').insert(payload);
        if (error) throw error;
        toast({ title: "Task created successfully!" });
      }

      setShowDialog(false);
      setEditingTask(null);
      fetchTasks();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      const { error } = await supabase.from('reward_tasks').delete().eq('id', taskId);
      if (error) throw error;
      toast({ title: "Task deleted" });
      fetchTasks();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const toggleActive = async (task: any) => {
    try {
      await supabase.from('reward_tasks').update({ is_active: !task.is_active }).eq('id', task.id);
      fetchTasks();
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const getIconComponent = (iconName: string | null) => {
    return iconOptions.find(o => o.value === iconName)?.icon || Trophy;
  };

  const openCreate = () => {
    setEditingTask({ title: "", description: "", reward_points: 50, reward_coins: 10, task_type: "action", requirement_count: 1, icon: "trophy", color: "#f97316", is_active: true, category: "general", requires_evidence: false });
    setShowDialog(true);
  };

  if (adminLoading) return <div className="min-h-screen bg-background p-4"><Skeleton className="h-64 rounded-xl" /></div>;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-50 bg-gradient-to-r from-amber-500 to-orange-500 pt-safe">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate('/admin')} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg text-white">Challenge Tasks</h1>
            <p className="text-white/80 text-xs">{tasks.length} tasks</p>
          </div>
          <Button onClick={openCreate} className="bg-white text-primary hover:bg-white/90 gap-2">
            <Plus className="h-4 w-4" /> Add Task
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) : tasks.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">No tasks yet</h3>
            <Button onClick={openCreate}>Create Task</Button>
          </div>
        ) : tasks.map((task) => {
          const Icon = getIconComponent(task.icon);
          return (
            <div key={task.id} className="bg-card rounded-xl border p-4 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: task.color || '#f97316' }}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div><h3 className="font-semibold">{task.title}</h3><p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p></div>
                  <Switch checked={task.is_active} onCheckedChange={() => toggleActive(task)} />
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="secondary">+{task.reward_points} pts</Badge>
                  <Badge variant="outline">{task.category}</Badge>
                  {task.expires_at && <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{format(new Date(task.expires_at), 'MMM d')}</Badge>}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={() => { setEditingTask(task); setShowDialog(true); }}><Edit className="h-4 w-4 mr-1" />Edit</Button>
                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDelete(task.id)}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingTask?.id ? 'Edit Task' : 'Create New Task'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Title *</Label><Input value={editingTask?.title || ''} onChange={(e) => setEditingTask((p: any) => ({ ...p, title: e.target.value }))} placeholder="e.g., Post 5 products this week" /></div>
            <div className="space-y-2"><Label>Description *</Label><Textarea value={editingTask?.description || ''} onChange={(e) => setEditingTask((p: any) => ({ ...p, description: e.target.value }))} placeholder="Describe what users need to do..." rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Reward Points</Label><Input type="number" value={editingTask?.reward_points || 50} onChange={(e) => setEditingTask((p: any) => ({ ...p, reward_points: parseInt(e.target.value) }))} /></div>
              <div className="space-y-2"><Label>Requirement Count</Label><Input type="number" value={editingTask?.requirement_count || 1} onChange={(e) => setEditingTask((p: any) => ({ ...p, requirement_count: parseInt(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Icon</Label><Select value={editingTask?.icon || 'trophy'} onValueChange={(v) => setEditingTask((p: any) => ({ ...p, icon: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{iconOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Category</Label><Select value={editingTask?.category || 'general'} onValueChange={(v) => setEditingTask((p: any) => ({ ...p, category: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categoryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Expires At (optional)</Label><Input type="datetime-local" value={editingTask?.expires_at?.slice(0, 16) || ''} onChange={(e) => setEditingTask((p: any) => ({ ...p, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} /></div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg"><div><p className="font-medium">Active</p><p className="text-sm text-muted-foreground">Task is visible to users</p></div><Switch checked={editingTask?.is_active ?? true} onCheckedChange={(c) => setEditingTask((p: any) => ({ ...p, is_active: c }))} /></div>
          </div>
          <div className="flex gap-3"><Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1">Cancel</Button><Button onClick={handleSave} disabled={saving} className="flex-1">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editingTask?.id ? 'Update' : 'Create'}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminChallenges;
