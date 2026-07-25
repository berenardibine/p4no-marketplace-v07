import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const TIER_STYLES: Record<string, string> = {
  bronze: 'from-amber-700 to-amber-500',
  silver: 'from-slate-400 to-slate-300',
  gold: 'from-yellow-500 to-amber-400',
  platinum: 'from-violet-500 to-fuchsia-400',
};

export { TIER_STYLES };

interface Props {
  code: string;
  name: string;
  description?: string;
  icon: string;
  tier: string;
  size?: 'sm' | 'md' | 'lg';
  earned?: boolean;
}

export default function BadgeChip({ code, name, description, icon, tier, size = 'md', earned = true }: Props) {
  const Icon = (Icons as any)[icon] || Icons.Award;
  const sizes = {
    sm: { box: 'w-8 h-8', icon: 'h-4 w-4' },
    md: { box: 'w-12 h-12', icon: 'h-6 w-6' },
    lg: { box: 'w-16 h-16', icon: 'h-8 w-8' },
  }[size];
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'rounded-2xl flex items-center justify-center shadow-md bg-gradient-to-br',
              sizes.box,
              earned ? TIER_STYLES[tier] || TIER_STYLES.bronze : 'from-muted to-muted/50 grayscale opacity-50'
            )}
            aria-label={name}
          >
            <Icon className={cn(sizes.icon, 'text-white drop-shadow')} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <p className="font-semibold">{name}</p>
            {description && <p className="text-muted-foreground">{description}</p>}
            {!earned && <p className="text-muted-foreground italic mt-1">Locked</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}