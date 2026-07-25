import { useState } from "react";
import {
  Award, Clock, CheckCircle, XCircle, ExternalLink,
  ChevronRight, Send, Image as ImageIcon, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { useTaskSubmissions } from "@/hooks/useTaskSubmissions";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SellerTasksTab = () => {
  const { tasks, submissions, loading, getSubmission, submitTask, refetch } = useTaskSubmissions();
  const { toast } = useToast();
  const { upload, isUploading } = useCloudinaryUpload();

  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [proofText, setProofText] = useState("");
  const [proofImage, setProofImage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await upload(file);
      setProofImage(url);
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    if (!selectedTask) return;
    const task = selectedTask;
    
    if (task.requires_evidence) {
      const needsScreenshot = task.evidence_type === 'screenshot' || task.evidence_type === 'both';
      const needsText = task.evidence_type === 'text' || task.evidence_type === 'both';
      if (needsScreenshot && !proofImage) {
        toast({ title: "Screenshot required", variant: "destructive" });
        return;
      }
      if (needsText && !proofText.trim()) {
        toast({ title: "Text evidence required", variant: "destructive" });
        return;
      }
    }

    setSubmitting(true);
    try {
      await submitTask(task.id, proofText || undefined, proofImage || undefined);
      toast({ title: "Task submitted for review! ✅" });
      setSelectedTask(null);
      setProofText("");
      setProofImage("");
    } catch (err: any) {
      if (err.message?.includes('duplicate')) {
        toast({ title: "Already submitted", description: "You've already submitted this task.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    }
    setSubmitting(false);
  };

  const getDifficultyColor = (d: string | null) => {
    if (d === 'hard') return 'from-red-500 to-rose-500';
    if (d === 'medium') return 'from-amber-500 to-orange-500';
    return 'from-green-500 to-emerald-500';
  };

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <Award className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <h3 className="font-semibold mb-2">No Tasks Available</h3>
        <p className="text-sm text-muted-foreground">Check back later for new tasks and rewards!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Points summary */}
      <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-4 text-primary-foreground">
        <div className="flex items-center gap-2 mb-1">
          <Award className="h-5 w-5" />
          <span className="font-medium text-sm">Available Tasks</span>
        </div>
        <p className="text-2xl font-bold">{tasks.length} tasks</p>
        <p className="text-xs opacity-80">{submissions.filter(s => s.status === 'approved').length} completed</p>
      </div>

      {tasks.map(task => {
        const sub = getSubmission(task.id);
        const isCompleted = sub?.status === 'approved';
        const isPending = sub?.status === 'pending';
        const isRejected = sub?.status === 'rejected';

        return (
          <div
            key={task.id}
            className={cn(
              "p-4 bg-card rounded-2xl border transition-all",
              isCompleted && "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm shrink-0",
                getDifficultyColor(task.difficulty)
              )}>
                <Award className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-sm">{task.title}</p>
                  <Badge variant="outline" className="text-[10px] capitalize">{task.difficulty || 'easy'}</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-primary">{task.reward_points} pts</span>
                  {task.reward_coins > 0 && <span className="text-xs font-bold text-amber-600">{task.reward_coins} coins</span>}
                  <Badge variant="outline" className="text-[10px] capitalize">{task.task_type}</Badge>
                </div>
              </div>
            </div>

            <div className="mt-3">
              {isCompleted ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Completed & Rewarded!</span>
                </div>
              ) : isPending ? (
                <div className="flex items-center gap-2 text-amber-600">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">Under Review</span>
                </div>
              ) : isRejected ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Rejected: {sub?.admin_notes || 'Try again'}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSelectedTask(task)} className="rounded-xl gap-2 w-full">
                    <Send className="h-3 w-3" /> Retry
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  {task.external_link && (
                    <Button size="sm" variant="outline" className="rounded-xl gap-2 flex-1" asChild>
                      <a href={task.external_link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" /> Open Link
                      </a>
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setSelectedTask(task)} className="rounded-xl gap-2 flex-1">
                    <Send className="h-3 w-3" /> Complete Task
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Submit Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => { setSelectedTask(null); setProofText(""); setProofImage(""); }}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Complete Task</DialogTitle>
            <DialogDescription>{selectedTask?.title}</DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-sm">{selectedTask.description}</p>
                <p className="text-xs font-bold text-primary mt-2">Reward: {selectedTask.reward_points} points</p>
              </div>

              {selectedTask.external_link && (
                <Button variant="outline" className="w-full rounded-xl gap-2" asChild>
                  <a href={selectedTask.external_link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" /> Open Task Link
                  </a>
                </Button>
              )}

              {selectedTask.requires_evidence && (selectedTask.evidence_type === 'text' || selectedTask.evidence_type === 'both') && (
                <Textarea
                  placeholder={selectedTask.text_hint || "Describe how you completed this task..."}
                  value={proofText}
                  onChange={e => setProofText(e.target.value)}
                  className="rounded-xl"
                />
              )}

              {selectedTask.requires_evidence && (selectedTask.evidence_type === 'screenshot' || selectedTask.evidence_type === 'both') && (
                <div>
                  {proofImage ? (
                    <div className="relative">
                      <img src={proofImage} alt="Proof" className="w-full rounded-xl max-h-40 object-contain" />
                      <Button size="sm" variant="destructive" className="absolute top-2 right-2 rounded-lg" onClick={() => setProofImage("")}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Upload screenshot</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                    </label>
                  )}
                </div>
              )}

              <Button onClick={handleSubmit} disabled={submitting || isUploading} className="w-full rounded-xl h-12 gap-2">
                <Send className="h-4 w-4" /> {submitting ? 'Submitting...' : 'I Have Completed This Task'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SellerTasksTab;
