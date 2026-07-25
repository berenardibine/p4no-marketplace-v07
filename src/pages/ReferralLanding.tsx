import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingBag, Gift, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSessionReferral } from '@/hooks/useReferral';

const ReferralLanding = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setReferral } = useSessionReferral();
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError('Invalid referral link');
      setLoading(false);
      return;
    }

    const validateAndStore = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, referral_code')
          .eq('referral_code', code)
          .maybeSingle();

        if (data) {
          setReferrerName(data.full_name);
          setReferral(code, data.full_name);
          // Also store in localStorage for persistence
          localStorage.setItem('p4no-referral-code', code);
          localStorage.setItem('p4no-referrer-name', data.full_name || '');
          
          // If user is already logged in, redirect to home with banner
          if (user) {
            navigate('/', { replace: true });
            return;
          }
          
          // Auto-redirect to signup after short delay
          setTimeout(() => {
            navigate('/auth', { replace: true });
          }, 3000);
        } else {
          setError('This referral code is invalid or expired');
        }
      } catch {
        setError('Could not validate referral code');
      } finally {
        setLoading(false);
      }
    };

    validateAndStore();
  }, [code, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Validating referral...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center p-4">
        <div className="text-center max-w-sm bg-card rounded-3xl p-8 border shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Gift className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold mb-2">Invalid Referral</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => navigate('/')} className="rounded-xl">
            Go to p4no
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center p-4">
      <div className="text-center max-w-sm bg-card rounded-3xl p-8 border shadow-xl">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mx-auto mb-6 shadow-lg">
          <ShoppingBag className="h-10 w-10 text-primary-foreground" />
        </div>
        
        <h1 className="text-2xl font-bold mb-2">Welcome to p4no!</h1>
        
        <div className="bg-primary/10 rounded-2xl p-4 mb-6 border border-primary/20">
          <Gift className="h-6 w-6 text-primary mx-auto mb-2" />
          <p className="text-sm text-foreground">
            You were referred by <span className="font-bold text-primary">{referrerName}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Code <span className="font-mono font-bold">{code}</span> will be applied automatically
          </p>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Join p4no and get special benefits! Redirecting to sign up...
        </p>

        <div className="space-y-3">
          <Button onClick={() => navigate('/auth')} className="w-full rounded-xl gap-2">
            <UserPlus className="h-4 w-4" />
            Sign Up Now
          </Button>
          <Button variant="outline" onClick={() => navigate('/')} className="w-full rounded-xl">
            Browse as Guest
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReferralLanding;
