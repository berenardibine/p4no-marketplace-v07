import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIER_STYLES } from './BadgeChip';
import type { BadgeProgress } from '@/hooks/useBadgeProgress';

interface Props {
  progress: BadgeProgress | null;
  open: boolean;
  onClose: () => void;
}

const BadgeDetailDialog = ({ progress, open, onClose }: Props) => {
  if (!progress) return null;
  const { definition: def, earned, current, target, percent, howTo } = progress;
  const Icon = (Icons as any)[def.icon] || Icons.Award;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br shadow-md',
              earned ? TIER_STYLES[def.tier] || TIER_STYLES.bronze : 'from-muted to-muted/50 grayscale opacity-60'
            )}>
              <Icon className="h-7 w-7 text-white drop-shadow" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="capitalize">{def.name}</DialogTitle>
              <DialogDescription className="capitalize text-xs">
                {def.tier} · {def.category} {earned ? '· Earned' : '· Locked'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{def.description}</p>
          <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">How to earn</p>
            <p className="text-sm">{howTo}</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{earned ? 'Completed' : 'Your progress'}</span>
              <span className="text-muted-foreground">{current}/{target} · {percent}%</span>
            </div>
            <Progress value={percent} className="h-2" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BadgeDetailDialog;