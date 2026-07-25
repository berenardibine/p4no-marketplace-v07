import { useState } from 'react';
import { Users, Gift, Clock, CheckCircle2, XCircle, TrendingUp, Star, Copy, Check, Trophy, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useReferral, useSellerRedemptions } from '@/hooks/useReferral';
import { useTasks } from '@/hooks/useRewards';
import { useMyProducts } from '@/hooks/useProducts';
import ShareReferral from '@/components/referral/ShareReferral';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

const SellerReferralTab = () => {
  const { referralCode, referrals, stats, loading, getShareUrl } = useReferral();
  const { tasks } = useTasks();
  const { redemptions, redeemTask } = useSellerRedemptions();
  const { products } = useMyProducts();
  const { toast } = useToast();
  const [redeemDialog, setRedeemDialog] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRedeem = async () => {
    if (!redeemDialog) return;
    setRedeeming(true);
    const result = await redeemTask(
      redeemDialog.id,
      redeemDialog.reward_type || 'featured',
      redeemDialog.reward_type === 'featured' ? selectedProduct : undefined
    );
    if (result.success) {
      toast({ title: 'Redemption submitted!', description: 'Waiting for admin approval.' });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
    setRedeemDialog(null);
    setSelectedProduct('');
    setRedeeming(false);
  };

  const copyCode = async () => {
    if (!referralCode) return;
    await navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast({ title: 'Referral code copied!' });
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter tasks relevant to referrals
  const referralTasks = tasks.filter(t => 
    t.task_type === 'referral' || t.title.toLowerCase().includes('referral')
  );

  return (
    <div className="space-y-4">
      {/* Referral Code & Link Card */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-5 border border-primary/20">
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Your Referral
        </h3>
        
        {referralCode ? (
          <div className="space-y-3">
            {/* Code display */}
            <div className="bg-card rounded-xl p-4 border text-center">
              <p className="text-xs text-muted-foreground mb-1">Your Referral Code</p>
              <div className="flex items-center justify-center gap-2">
                <p className="text-3xl font-mono font-bold text-primary tracking-wider">{referralCode}</p>
                <button onClick={copyCode} className="p-2 rounded-lg hover:bg-muted transition-colors">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                </button>
              </div>
            </div>

            {/* Share link */}
            <div className="bg-card rounded-xl p-3 border">
              <p className="text-xs text-muted-foreground mb-2">Your Referral Link</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-xs text-muted-foreground truncate border">
                  {getShareUrl()}
                </div>
                <Button 
                  size="sm" 
                  className="rounded-lg shrink-0"
                  onClick={async () => {
                    await navigator.clipboard.writeText(getShareUrl());
                    toast({ title: 'Link copied!' });
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No referral code yet. Complete your profile to get one.</p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-2xl p-4 border shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-2 shadow-md">
            <Users className="h-5 w-5 text-white" />
          </div>
          <p className="text-2xl font-bold">{stats.totalReferrals}</p>
          <p className="text-xs text-muted-foreground">Total Referrals</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-2 shadow-md">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
          <p className="text-2xl font-bold">{stats.activeReferrals}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-2 shadow-md">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <p className="text-2xl font-bold">{stats.pendingReferrals}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center mb-2 shadow-md">
            <Gift className="h-5 w-5 text-white" />
          </div>
          <p className="text-2xl font-bold">{stats.totalRewards}</p>
          <p className="text-xs text-muted-foreground">Points Earned</p>
        </div>
      </div>

      {/* Share Section */}
      <div className="bg-card rounded-2xl p-4 border shadow-sm">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Share & Earn
        </h3>
        <ShareReferral />
      </div>

      {/* Active Tasks */}
      {referralTasks.length > 0 && (
        <div className="bg-card rounded-2xl p-4 border shadow-sm">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Active Tasks
          </h3>
          <div className="space-y-2">
            {referralTasks.map(task => {
              const alreadyRedeemed = redemptions.some((r: any) => r.task_id === task.id);
              const meetsRequirement = stats.activeReferrals >= task.requirement_count;
              const progress = Math.min(stats.activeReferrals / task.requirement_count * 100, 100);
              
              return (
                <div key={task.id} className="p-4 rounded-xl bg-muted/30 border">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                    </div>
                    {alreadyRedeemed ? (
                      <Badge variant="outline" className="text-[10px] bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 shrink-0">
                        Redeemed
                      </Badge>
                    ) : meetsRequirement ? (
                      <Button size="sm" className="rounded-lg text-xs shrink-0" onClick={() => setRedeemDialog(task)}>
                        Redeem
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        <Clock className="h-3 w-3 mr-1" /> In progress
                      </Badge>
                    )}
                  </div>
                  
                  {/* Progress bar */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{stats.activeReferrals}/{task.requirement_count} referrals</span>
                      <span className="font-medium text-primary">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2">
                    {(task as any).reward_type === 'featured' && (
                      <div className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Star className="h-3 w-3" /> Featured {(task as any).featured_duration_days || 7}d
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Redemption History */}
      {redemptions.length > 0 && (
        <div className="bg-card rounded-2xl p-4 border shadow-sm">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            Redemption History
          </h3>
          <div className="space-y-2">
            {redemptions.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.task?.title || 'Reward'}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.created_at ? format(new Date(r.created_at), 'MMM d, yyyy') : ''}
                  </p>
                </div>
                <Badge variant="outline" className={cn("text-[10px]",
                  r.status === 'approved' && "bg-green-50 text-green-700 border-green-200",
                  r.status === 'pending' && "bg-amber-50 text-amber-700 border-amber-200",
                  r.status === 'rejected' && "bg-red-50 text-red-700 border-red-200",
                )}>
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Referral List */}
      <div className="bg-card rounded-2xl p-4 border shadow-sm">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Your Referrals
        </h3>
        
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No referrals yet. Share your code to get started!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map((ref) => (
              <div key={ref.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {(ref.referee?.full_name || ref.referral_code)?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {ref.referee?.full_name || `Referee #${ref.id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ref.created_at ? format(new Date(ref.created_at), 'MMM d, yyyy') : 'N/A'}
                    {ref.status === 'pending' && ` • ${ref.referee_products_count || 0}/3 products • ${ref.referee_account_age_days || 0}/7 days`}
                  </p>
                </div>
                <Badge variant="outline" className={cn("text-[10px]",
                  ref.status === 'active' && "bg-green-50 text-green-700 border-green-200",
                  ref.status === 'pending' && "bg-amber-50 text-amber-700 border-amber-200",
                  ref.status === 'invalid' && "bg-red-50 text-red-700 border-red-200",
                )}>
                  {ref.status === 'active' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {ref.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                  {ref.status === 'invalid' && <XCircle className="h-3 w-3 mr-1" />}
                  {ref.status || 'pending'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Redeem Dialog */}
      <Dialog open={!!redeemDialog} onOpenChange={() => setRedeemDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redeem: {redeemDialog?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{redeemDialog?.description}</p>
            {redeemDialog?.reward_type === 'featured' && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Select a product to feature:</p>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Featured for {(redeemDialog as any)?.featured_duration_days || 7} days. Requires admin approval.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedeemDialog(null)}>Cancel</Button>
            <Button onClick={handleRedeem} disabled={redeeming || (redeemDialog?.reward_type === 'featured' && !selectedProduct)}>
              {redeeming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SellerReferralTab;
