import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, LogIn, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
}

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const GuestPromptDialog = ({ open, onOpenChange, title, description }: Props) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast({ title: 'Google sign-in failed', description: error.message, variant: 'destructive' });
      setGoogleLoading(false);
    }
  };

  const go = (path: string) => { onOpenChange(false); navigate(path); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl border-border/40 p-0 overflow-hidden">
        {/* Hero */}
        <div className="bg-gradient-to-br from-primary via-orange-500 to-amber-500 px-6 pt-7 pb-8 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 bg-white/20 backdrop-blur flex items-center justify-center border border-white/30">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-white text-xl font-extrabold tracking-tight">
              {title || 'Join the P4NO community'}
            </DialogTitle>
            <DialogDescription className="text-white/85 text-sm">
              {description || 'Create your free account to comment, follow, save, order and get personalized updates.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Actions */}
        <div className="p-5 space-y-2.5">
          <Button
            onClick={handleGoogle}
            disabled={googleLoading}
            variant="outline"
            className="w-full h-12 rounded-2xl font-semibold gap-3 border-border/60 hover:bg-accent"
          >
            {googleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </Button>

          <Button
            onClick={() => go('/auth?mode=signup')}
            className="w-full h-12 rounded-2xl font-semibold gap-2 bg-gradient-to-r from-primary to-orange-500 hover:opacity-95 text-primary-foreground shadow-orange"
          >
            <UserPlus className="h-4 w-4" />
            Sign Up — it's free
          </Button>

          <Button
            onClick={() => go('/auth?mode=signin')}
            variant="ghost"
            className="w-full h-11 rounded-2xl font-medium gap-2 text-foreground"
          >
            <LogIn className="h-4 w-4" />
            I already have an account
          </Button>

          <p className="text-center text-[11px] text-muted-foreground pt-1">
            🔒 Secure account · Free forever · Cancel anytime
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GuestPromptDialog;
