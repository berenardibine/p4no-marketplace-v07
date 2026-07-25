import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, RefreshCw, Plus, Check, X, Eye, Trash2,
  Search, ListChecks, Award, Clock, CheckCircle, XCircle,
  ExternalLink, Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminTaskSubmissions, RewardTask } from "@/hooks/useTaskSubmissions";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const AdminTasks = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { submissions, tasks, loading, reviewSubmission, createTask, updateTask, deleteTask, refetch } = useAdminTaskSubmissions();
  const { toast } = useToast();

  const [tab, setTab] = useState<'submissions' | 'tasks'>('submissions');
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewSub, setViewSub] = useState<any>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Task creation
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', task_type: 'social', reward_points: 50,
    reward_coins: 0, category: 'general', difficulty: 'easy',
    requires_evidence: true, evidence_type: 'screenshot', external_link: '',
    is_active: true, reward_type: 'points', text_hint: '',
  });

  const handleReview = async () => {
    if (!viewSub || !actionType) return;
    if (actionType === 'reject' && !notes.trim()) {
      toast({ title: "Provide rejection reason", variant: "destructive" });
      return;
    }
    setActionLoading(true);
    try {
      await reviewSubmission(viewSub.id, actionType === 'approve' ? 'approved' : 'rejected', notes, viewSub.user_id, viewSub.task_id);
      toast({ title: actionType === 'approve' ? 'Approved & rewarded!' : 'Rejected' });
      setViewSub(null);
      setActionType(null);
      setNotes("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setActionLoading(false);
  };

  const handleCreateTask = async () => {
    if (!taskForm.title || !taskForm.description) {
      toast({ title: "Title and description required", variant: "destructive" });
      return;
    }
    try {
      await createTask(taskForm);
      toast({ title: "Task created!" });
      setShowTaskForm(false);
      setTaskForm({ title: '', description: '', task_type: 'social', reward_points: 50, reward_coins: 0, category: 'general', difficulty: 'easy', requires_evidence: true, evidence_type: 'screenshot', external_link: '', is_active: true, reward_type: 'points', text_hint: '' });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getTaskTitle = (taskId: string) => tasks.find(t => t.id === taskId)?.title || 'Unknown';

  const filteredSubs = submissions.filter(s => {
    const name = s.profiles?.full_name || '';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || s.status === filter;
    return matchesSearch && matchesFilter;
  });

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    return <Badge className={cn("text-xs capitalize", styles[status] || '')}>{status}</Badge>;
  };

  if (adminLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAdmin) { navigate('/'); return null; }

  const pending = submissions.filter(s => s.status === 'pending').length;
  const approved = submissions.filter(s => s.status === 'approved').length;
  const rejected = submissions.filter(s => s.status === 'rejected').length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate('/admin')} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">Tasks & Rewards</h1>
            <p className="text-xs text-muted-foreground">{submissions.length} submissions, {tasks.length} tasks</p>
          </div>
          <Button variant="outline" size="icon" className="rounded-xl" onClick={refetch}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-xl p-3 border text-center">
            <p className="text-lg font-bold text-amber-600">{pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="bg-card rounded-xl p-3 border text-center">
            <p className="text-lg font-bold text-green-600">{approved}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </div>
          <div className="bg-card rounded-xl p-3 border text-center">
            <p className="text-lg font-bold text-red-600">{rejected}</p>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <Button variant={tab === 'submissions' ? 'default' : 'outline'} onClick={() => setTab('submissions')} className="flex-1 rounded-xl gap-2">
            <ListChecks className="h-4 w-4" /> Submissions
          </Button>
          <Button variant={tab === 'tasks' ? 'default' : 'outline'} onClick={() => setTab('tasks')} className="flex-1 rounded-xl gap-2">
            <Award className="h-4 w-4" /> Tasks
          </Button>
        </div>

        {tab === 'submissions' ? (
          <>
            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto">
              {['all', 'pending', 'approved', 'rejected'].map(f => (
                <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="rounded-full capitalize text-xs">
                  {f}
                </Button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-11 rounded-xl bg-card" />
            </div>

            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
            ) : filteredSubs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ListChecks className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No submissions found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSubs.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setViewSub(sub)}
                    className="w-full p-4 bg-card rounded-xl border text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {sub.profiles?.profile_image ? (
                          <img src={sub.profiles.profile_image} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <Award className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{sub.profiles?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground truncate">{getTaskTitle(sub.task_id)}</p>
                      </div>
                      {statusBadge(sub.status)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <Button onClick={() => setShowTaskForm(true)} className="w-full gap-2 rounded-xl h-12">
              <Plus className="h-4 w-4" /> Create New Task
            </Button>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Award className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No tasks created yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => (
                  <div key={task.id} className="p-4 bg-card rounded-xl border">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{task.title}</p>
                          <Badge variant="outline" className="text-xs">{task.task_type}</Badge>
                          {!task.is_active && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs font-medium text-primary">{task.reward_points} pts</span>
                          {task.reward_coins > 0 && <span className="text-xs font-medium text-amber-600">{task.reward_coins} coins</span>}
                          <Badge variant="outline" className="text-xs capitalize">{task.difficulty || 'easy'}</Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateTask(task.id, { is_active: !task.is_active })}>
                          {task.is_active ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTask(task.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* View Submission Dialog */}
      <Dialog open={!!viewSub} onOpenChange={() => { setViewSub(null); setActionType(null); setNotes(""); }}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Review Submission</DialogTitle>
            <DialogDescription>Review and approve or reject this task submission.</DialogDescription>
          </DialogHeader>
          {viewSub && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-xl p-3 space-y-2">
                <p className="text-sm"><span className="font-medium">User:</span> {viewSub.profiles?.full_name}</p>
                <p className="text-sm"><span className="font-medium">Task:</span> {getTaskTitle(viewSub.task_id)}</p>
                <p className="text-sm"><span className="font-medium">Status:</span> {statusBadge(viewSub.status)}</p>
                <p className="text-xs text-muted-foreground">Submitted: {new Date(viewSub.created_at).toLocaleString()}</p>
              </div>

              {viewSub.proof_text && (
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xs font-medium mb-1">Evidence (Text):</p>
                  <p className="text-sm">{viewSub.proof_text}</p>
                </div>
              )}

              {viewSub.proof_image && (
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xs font-medium mb-1">Evidence (Image):</p>
                  <img src={viewSub.proof_image} alt="Proof" className="w-full rounded-lg max-h-48 object-contain" />
                </div>
              )}

              {viewSub.status === 'pending' && (
                <>
                  <Textarea placeholder="Admin notes (required for rejection)..." value={notes} onChange={e => setNotes(e.target.value)} className="rounded-xl" />
                  <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={() => { setActionType('reject'); }} disabled={actionLoading} className="flex-1 gap-2 rounded-xl text-destructive">
                      <X className="h-4 w-4" /> Reject
                    </Button>
                    <Button onClick={() => { setActionType('approve'); }} disabled={actionLoading} className="flex-1 gap-2 rounded-xl bg-green-600 hover:bg-green-700">
                      <Check className="h-4 w-4" /> Approve
                    </Button>
                  </DialogFooter>
                  {actionType && (
                    <Button onClick={handleReview} disabled={actionLoading} className={cn("w-full rounded-xl", actionType === 'approve' ? 'bg-green-600' : 'bg-destructive')}>
                      {actionLoading ? 'Processing...' : `Confirm ${actionType}`}
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={showTaskForm} onOpenChange={setShowTaskForm}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Create a task for users to complete and earn rewards.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Task title" value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} className="rounded-xl" />
            <Textarea placeholder="Task description" value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} className="rounded-xl" />
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                <Select value={taskForm.task_type} onValueChange={v => setTaskForm(p => ({ ...p, task_type: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="social">Social Media</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="action">Action</SelectItem>
                    <SelectItem value="profile">Profile</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Difficulty</label>
                <Select value={taskForm.difficulty} onValueChange={v => setTaskForm(p => ({ ...p, difficulty: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Reward Points</label>
                <Input type="number" value={taskForm.reward_points} onChange={e => setTaskForm(p => ({ ...p, reward_points: Number(e.target.value) }))} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Reward Coins</label>
                <Input type="number" value={taskForm.reward_coins} onChange={e => setTaskForm(p => ({ ...p, reward_coins: Number(e.target.value) }))} className="rounded-xl" />
              </div>
            </div>

            <Input placeholder="External link (e.g. Facebook page URL)" value={taskForm.external_link} onChange={e => setTaskForm(p => ({ ...p, external_link: e.target.value }))} className="rounded-xl" />

            <div className="flex items-center justify-between bg-muted/50 rounded-xl p-3">
              <label className="text-sm font-medium">Requires Evidence</label>
              <Switch checked={taskForm.requires_evidence} onCheckedChange={v => setTaskForm(p => ({ ...p, requires_evidence: v }))} />
            </div>

            {taskForm.requires_evidence && (
              <Select value={taskForm.evidence_type} onValueChange={v => setTaskForm(p => ({ ...p, evidence_type: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Evidence type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="screenshot">Screenshot</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            )}

            {taskForm.requires_evidence && (taskForm.evidence_type === 'text' || taskForm.evidence_type === 'both') && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Text Input Hint (what user should type)</label>
                <Input
                  placeholder="e.g. Enter your email, Your social media username, Comment you shared..."
                  value={taskForm.text_hint}
                  onChange={e => setTaskForm(p => ({ ...p, text_hint: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            )}

            <Button onClick={handleCreateTask} className="w-full rounded-xl h-12 gap-2">
              <Plus className="h-4 w-4" /> Create Task
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTasks;
