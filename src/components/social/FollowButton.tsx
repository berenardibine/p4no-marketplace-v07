import { Heart, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFollow, FollowTarget } from '@/hooks/useFollow';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import GuestPromptDialog from '@/components/auth/GuestPromptDialog';

interface Props {
  targetType: FollowTarget;
  targetId?: string | null;
  size?: 'sm' | 'md' | 'icon';
  showCount?: boolean;
  className?: string;
}

const FollowButton = ({ targetType, targetId, size = 'md', showCount = false, className }: Props) => {
  const { isFollowing, count, loading, toggle } = useFollow(targetType, targetId);
  const { requireAuth, promptOpen, setPromptOpen } = useRequireAuth();

  if (!targetId) return null;

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    requireAuth(() => { toggle(); });
  };

  if (size === 'icon') {
    return (
      <>
        <button
          onClick={onClick}
          aria-label={isFollowing ? 'Unfollow' : 'Follow'}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center transition-all border',
            isFollowing ? 'bg-primary text-primary-foreground border-primary' : 'bg-background/80 backdrop-blur text-foreground border-border',
            className
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> :
            isFollowing ? <Check className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
        </button>
        <GuestPromptDialog open={promptOpen} onOpenChange={setPromptOpen} title="Sign up to follow" />
      </>
    );
  }

  return (
    <>
      <Button
        onClick={onClick}
        variant={isFollowing ? 'outline' : 'default'}
        size={size === 'sm' ? 'sm' : 'default'}
        className={cn('rounded-full font-semibold gap-1.5', className)}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> :
          isFollowing ? <><Check className="h-4 w-4" /> Following</> :
          <><Heart className="h-4 w-4" /> Follow</>}
        {showCount && count > 0 && <span className="ml-1 opacity-70">· {count}</span>}
      </Button>
      <GuestPromptDialog open={promptOpen} onOpenChange={setPromptOpen} title="Sign up to follow" />
    </>
  );
};

export default FollowButton;
