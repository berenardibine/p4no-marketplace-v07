import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Rocket, Check, X, Clock, Loader2, Plus, Trash2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAdmin } from '@/hooks/useAdmin';
import { useAdminBoosts } from '@/hooks/useBoostedProducts';
import { useAdminBoostPlans } from '@/hooks/useWallet';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const AdminBoosts = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { boosts, loading, updateBoostStatus, refetch } = useAdminBoosts();
  const { plans, createPlan, updatePlan, deletePlan, loading: plansLoading } = useAdminBoostPlans();
  const { toast } = useToast();
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [tab, setTab] = useState<'requests' | 'plans'>('requests');
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState({ name: '', duration_days: 1, cost_points: 50 });

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) { navigate('/'); return null; }

  const handleApprove = async (boostId: string) => {
    try {
      await updateBoostStatus(boostId, 'active', 'Approved by admin');
      toast({ title: 'Boost activated! 🚀' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    try {
      await updateBoostStatus(rejectModal, 'rejected', rejectReason);
      toast({ title: 'Boost rejected' });
      setRejectModal(null);
      setRejectReason('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleCreatePlan = async () => {
    if (!planForm.name) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    try {
      await createPlan(planForm);
      toast({ title: 'Plan created!' });
      setShowPlanForm(false);
      setPlanForm({ name: '', duration_days: 1, cost_points: 50 });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'expired': return 'bg-muted text-muted-foreground';
      case 'rejected': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate('/admin')} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-semibold text-lg">Boost Management</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          <Button variant={tab === 'requests' ? 'default' : 'outline'} onClick={() => setTab('requests')} className="flex-1 rounded-xl gap-2">
            <Rocket className="h-4 w-4" /> Requests
          </Button>
          <Button variant={tab === 'plans' ? 'default' : 'outline'} onClick={() => setTab('plans')} className="flex-1 rounded-xl gap-2">
            <Settings className="h-4 w-4" /> Plans & Pricing
          </Button>
        </div>

        {tab === 'requests' ? (
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : boosts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Rocket className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No boost requests yet</p>
              </div>
            ) : (
              boosts.map((boost: any) => (
                <div key={boost.id} className="bg-card rounded-2xl border p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold">{boost.product?.title || 'Unknown Product'}</p>
                      <p className="text-sm text-muted-foreground">by {boost.seller?.full_name || 'Unknown'}</p>
                    </div>
                    <Badge className={statusColor(boost.status)}>{boost.status}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{boost.duration_days} days</span>
                    {boost.points_cost > 0 && (
                      <span className="font-medium text-primary">{boost.points_cost} pts</span>
                    )}
                    <span>{new Date(boost.created_at).toLocaleDateString()}</span>
                  </div>
                  {boost.admin_notes && (
                    <p className="text-xs text-muted-foreground bg-muted rounded-lg p-2">{boost.admin_notes}</p>
                  )}
                  {boost.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleApprove(boost.id)} className="flex-1 gap-1 rounded-xl">
                        <Check className="h-4 w-4" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRejectModal(boost.id)} className="flex-1 gap-1 rounded-xl">
                        <X className="h-4 w-4" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Button onClick={() => setShowPlanForm(true)} className="w-full gap-2 rounded-xl h-12">
              <Plus className="h-4 w-4" /> Create Boost Plan
            </Button>

            {plansLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : plans.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No plans yet</p>
            ) : (
              plans.map((plan: any) => (
                <div key={plan.id} className="bg-card rounded-xl border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{plan.name}</p>
                      <p className="text-sm text-muted-foreground">{plan.duration_days} day{plan.duration_days > 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-primary">{plan.cost_points} pts</span>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deletePlan(plan.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => updatePlan(plan.id, { is_active: !plan.is_active })}>
                      {plan.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      <Dialog open={!!rejectModal} onOpenChange={() => setRejectModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Boost Request</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <Button onClick={handleReject} variant="destructive" className="w-full rounded-xl">
            Reject Boost
          </Button>
        </DialogContent>
      </Dialog>

      {/* Create Plan Dialog */}
      <Dialog open={showPlanForm} onOpenChange={setShowPlanForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Boost Plan</DialogTitle>
            <DialogDescription>Set the pricing for product boosts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Plan name (e.g. 3 Days Boost)" value={planForm.name} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))} className="rounded-xl" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Duration (days)</label>
                <Input type="number" min={1} value={planForm.duration_days} onChange={e => setPlanForm(p => ({ ...p, duration_days: Number(e.target.value) }))} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cost (points)</label>
                <Input type="number" min={1} value={planForm.cost_points} onChange={e => setPlanForm(p => ({ ...p, cost_points: Number(e.target.value) }))} className="rounded-xl" />
              </div>
            </div>
            <Button onClick={handleCreatePlan} className="w-full rounded-xl">Create Plan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBoosts;
