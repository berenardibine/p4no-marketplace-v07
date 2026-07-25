import { Bookmark, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSavedItem, SavedItemType } from '@/hooks/useSavedItems';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import GuestPromptDialog from '@/components/auth/GuestPromptDialog';

interface Props {
  itemType: SavedItemType;
  itemId?: string | null;
  className?: string;
}

const SaveButton = ({ itemType, itemId, className }: Props) => {
  const { isSaved, loading, toggle } = useSavedItem(itemType, itemId);
  const { requireAuth, promptOpen, setPromptOpen } = useRequireAuth();

  if (!itemId) return null;

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    requireAuth(() => { toggle(); });
  };

  return (
    <>
      <button
        onClick={onClick}
        aria-label={isSaved ? 'Remove from saved' : 'Save'}
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center transition-all',
          'bg-background/80 backdrop-blur border border-border hover:bg-background',
          isSaved && 'text-primary',
          className
        )}
      >
        {loading
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Bookmark className={cn('h-4 w-4', isSaved && 'fill-current')} />}
      </button>
      <GuestPromptDialog open={promptOpen} onOpenChange={setPromptOpen} title="Sign up to save items" />
    </>
  );
};

export default SaveButton;
