import { X, Gift } from 'lucide-react';
import { useSessionReferral } from '@/hooks/useReferral';

const ReferralBanner = () => {
  const { sessionCode, referrerName, clearReferral } = useSessionReferral();

  if (!sessionCode) return null;

  return (
    <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-3 mx-4 mb-3 flex items-center gap-3 animate-fade-up">
      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
        <Gift className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Referred by <span className="text-primary">{referrerName || 'a friend'}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Code <span className="font-mono font-bold">{sessionCode}</span> applied
        </p>
      </div>
      <button
        onClick={clearReferral}
        className="p-1.5 rounded-full hover:bg-muted transition-colors shrink-0"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
};

export default ReferralBanner;
