import { useState } from 'react';
import BadgeChip from './BadgeChip';
import BadgeDetailDialog from './BadgeDetailDialog';
import { Award, Lock, CheckCircle2 } from 'lucide-react';
import { useBadgeProgress, type BadgeProgress } from '@/hooks/useBadgeProgress';
import { Progress } from '@/components/ui/progress';

interface Props { userId: string; compact?: boolean; }

export default function SellerAchievementsCard({ userId, compact = false }: Props) {
  const { progress, loading } = useBadgeProgress(userId);
  const [active, setActive] = useState<BadgeProgress | null>(null);
  if (loading) return null;

  const earned = progress.filter(p => p.earned);
  const inProgress = progress.filter(p => !p.earned);
  const nextBadge = inProgress[0];

  return (
    <section className="bg-card rounded-2xl border p-4 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
          <Award className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-sm">Achievements</h3>
          <p className="text-[11px] text-muted-foreground">
            {earned.length} earned · {progress.length} total
          </p>
        </div>
      </div>

      {/* Earned badges */}
      {earned.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Earned
          </p>
          <div className="grid grid-cols-5 gap-3">
            {earned.map((p) => (
              <button key={p.definition.code} type="button" onClick={() => setActive(p)} className="flex flex-col items-center gap-1 group">
                <BadgeChip code={p.definition.code} name={p.definition.name} description={p.definition.description} icon={p.definition.icon} tier={p.definition.tier} earned size="md" />
                <span className="text-[10px] text-center text-muted-foreground line-clamp-1 group-hover:text-foreground">{p.definition.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Next badge spotlight */}
      {nextBadge && (
        <button type="button" onClick={() => setActive(nextBadge)} className="w-full text-left rounded-xl p-3 bg-gradient-to-r from-primary/5 via-orange-500/5 to-amber-500/5 border border-primary/15 hover:border-primary/30 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <BadgeChip {...nextBadge.definition} earned={false} size="md" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{nextBadge.definition.name}</p>
              <p className="text-[11px] text-muted-foreground line-clamp-2">{nextBadge.howTo}</p>
            </div>
          </div>
          <Progress value={nextBadge.percent} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground mt-1 text-right">
            {nextBadge.current}/{nextBadge.target} · {nextBadge.percent}%
          </p>
        </button>
      )}

      {/* All in progress */}
      {!compact && inProgress.length > 1 && (
        <div>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
            <Lock className="h-3 w-3" /> In progress
          </p>
          <div className="space-y-2">
            {inProgress.slice(1).map((p) => (
              <button key={p.definition.code} type="button" onClick={() => setActive(p)} className="w-full flex items-center gap-3 p-2 rounded-lg bg-muted/40 hover:bg-muted text-left">
                <BadgeChip {...p.definition} earned={false} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{p.definition.name}</p>
                  <Progress value={p.percent} className="h-1 mt-1" />
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{p.current}/{p.target}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <BadgeDetailDialog progress={active} open={!!active} onClose={() => setActive(null)} />
    </section>
  );
}