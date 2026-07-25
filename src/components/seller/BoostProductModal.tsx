import { useState, useEffect } from 'react';
import { Rocket, Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useWallet, useBoostPlans } from '@/hooks/useWallet';
import { cn } from '@/lib/utils';

interface BoostProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productTitle: string;
  onSubmit: (durationDays: number, planId: string, costPoints: number) => Promise<void>;
}

const BoostProductModal = ({ isOpen, onClose, productTitle, onSubmit }: BoostProductModalProps) => {
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { wallet, loading: walletLoading } = useWallet();
  const { plans, loading: plansLoading } = useBoostPlans();

  useEffect(() => {
    if (plans.length > 0 && !selectedPlan) {
      setSelectedPlan(plans[0].id);
    }
  }, [plans]);

  const selected = plans.find((p: any) => p.id === selectedPlan);

  const handleSubmit = async () => {
    if (!selected) return;
    if ((wallet?.balance || 0) < selected.cost_points) {
      toast({ title: 'Not enough points', description: `You need ${selected.cost_points} points but have ${wallet?.balance || 0}.`, variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(selected.duration_days, selected.id, selected.cost_points);
      toast({ title: 'Boost request submitted! 🚀', description: 'Admin will review and activate your boost.' });
      onClose();
    } catch (err: any) {
      toast({ title: 'Failed to submit boost request', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Boost Product
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Boost <strong>{productTitle}</strong> to appear at the top of listings.
          </p>

          {/* Wallet Balance */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Your Balance</p>
              <p className="text-lg font-bold text-primary">{walletLoading ? '...' : `${wallet?.balance || 0} points`}</p>
            </div>
          </div>

          {plansLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : plans.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No boost plans available. Contact admin.</p>
          ) : (
            <div className="space-y-2">
              {plans.map((plan: any) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={cn(
                    'w-full p-4 rounded-xl border-2 text-left transition-all',
                    selectedPlan === plan.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{plan.name}</p>
                      <p className="text-sm text-muted-foreground">{plan.duration_days} day{plan.duration_days > 1 ? 's' : ''}</p>
                    </div>
                    <span className={cn(
                      "text-sm font-bold px-3 py-1 rounded-full",
                      (wallet?.balance || 0) >= plan.cost_points
                        ? "bg-primary/10 text-primary"
                        : "bg-destructive/10 text-destructive"
                    )}>
                      {plan.cost_points} pts
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Points will be deducted after admin approval.
          </p>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !selected || (wallet?.balance || 0) < (selected?.cost_points || 0)}
            className="w-full gap-2 rounded-xl"
          >
            {submitting ? 'Submitting...' : `Request Boost (${selected?.cost_points || 0} pts)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BoostProductModal;
