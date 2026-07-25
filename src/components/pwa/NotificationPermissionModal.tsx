import { Bell, X, MessageCircle, Package, Store, Sparkles, Briefcase, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface Props {
  open: boolean;
  onEnable: () => void;
  onDismiss: () => void;
  enabling?: boolean;
}

const benefits = [
  { icon: MessageCircle, label: 'New Replies' },
  { icon: Package, label: 'Product Updates' },
  { icon: Store, label: 'Seller Updates' },
  { icon: Sparkles, label: 'Personalized Recommendations' },
  { icon: Briefcase, label: 'Opportunities & Alerts' },
];

const NotificationPermissionModal = ({ open, onEnable, onDismiss, enabling }: Props) => {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !enabling) onDismiss();
      }}
    >
      <DialogContent
        className="sm:max-w-sm gap-0 p-0 overflow-hidden border-0 rounded-2xl"
        onPointerDownOutside={(e) => {
          if (enabling) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (enabling) e.preventDefault();
        }}
      >
        <VisuallyHidden>
          <DialogTitle>Stay Updated With P4NO</DialogTitle>
          <DialogDescription>
            Enable browser notifications to receive updates from P4NO.
          </DialogDescription>
        </VisuallyHidden>

        {/* Close button */}
        <button
          type="button"
          onClick={onDismiss}
          disabled={enabling}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-8 pb-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Bell className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold tracking-tight">Stay Updated With P4NO</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Be the first to know what matters to you.
          </p>
        </div>

        {/* Benefits */}
        <ul className="space-y-2.5 px-6 py-4">
          {benefits.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="font-medium text-foreground">{label}</span>
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="flex flex-col gap-2 px-6 pb-6">
          <Button
            onClick={onEnable}
            disabled={enabling}
            className="w-full h-11 font-semibold"
          >
            {enabling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up notifications...
              </>
            ) : (
              'Enable Notifications'
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={onDismiss}
            disabled={enabling}
            className="w-full h-10 text-muted-foreground"
          >
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationPermissionModal;
