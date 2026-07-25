import { useNavigate } from 'react-router-dom';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { isProfileComplete, profileCompletionPercent, missingProfileFields } from '@/lib/profileCompletion';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'profile_banner_dismissed';

const ProfileCompletionBanner = () => {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  if (loading || !user || !profile) return null;
  if (isProfileComplete(profile)) return null;
  if (dismissed) return null;

  const percent = profileCompletionPercent(profile);
  const missing = missingProfileFields(profile);

  const handleClose = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className={cn(
      "relative rounded-2xl p-4 mb-3",
      "bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10",
      "border border-primary/20"
    )}>
      <button
        onClick={handleClose}
        aria-label="Dismiss"
        className="absolute top-2 right-2 w-7 h-7 rounded-full hover:bg-background/50 flex items-center justify-center"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
      <div className="flex items-start gap-3 pr-7">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm mb-1">Complete your profile to unlock full features</h3>
          <p className="text-xs text-muted-foreground mb-2">
            Missing: {missing.map(f => f.replace(/_/g, ' ')).join(', ')}
          </p>
          <div className="flex items-center gap-2 mb-2">
            <Progress value={percent} className="h-1.5 flex-1" />
            <span className="text-xs font-semibold text-primary">{percent}%</span>
          </div>
          <button
            onClick={() => navigate('/complete-profile/phone')}
            className="text-xs font-semibold text-primary inline-flex items-center gap-1 hover:underline"
          >
            Complete now <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletionBanner;