import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ShoppingBag, WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ErrorType = 'network' | 'config' | 'auth' | null;

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Completing sign in...');
  const [errorType, setErrorType] = useState<ErrorType>(null);
  const [errorDetail, setErrorDetail] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        if (!navigator.onLine) {
          setErrorType('network');
          setErrorDetail('Please check your internet connection and try again.');
          return;
        }

        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const urlError = hashParams.get('error');
        const urlErrorDesc = hashParams.get('error_description');

        if (urlError) {
          console.error('[p4no] OAuth error:', urlError, urlErrorDesc);
          if (urlError.includes('redirect') || urlErrorDesc?.includes('redirect')) {
            setErrorType('config');
            setErrorDetail('Redirect URI mismatch. The authentication service is misconfigured.');
          } else {
            setErrorType('auth');
            setErrorDetail(urlErrorDesc || 'Authentication was rejected.');
          }
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          console.error('[p4no] No session:', error);
          setErrorType('auth');
          setErrorDetail('No session was created. Please try signing in again.');
          return;
        }

        console.log('[p4no] Session established for', session.user.email);
        setStatus('Checking your profile...');

        // Check if user has a profile in the database
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, call_number, whatsapp_number, referral_code, full_name, phone_number, country')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!existingProfile) {
          // First-time Google user — create a minimal profile and send to onboarding
          await supabase.from('profiles').insert({
            id: session.user.id,
            email: session.user.email!,
            full_name: session.user.user_metadata?.full_name || session.user.email!.split('@')[0],
            user_type: 'buyer',
          });
          navigate('/onboarding/account-type', { replace: true });
          return;
        }

        // Auto-generate referral code if missing
        if (!existingProfile.referral_code) {
          const code = 'P4' + Math.random().toString(36).substring(2, 8).toUpperCase();
          await supabase
            .from('profiles')
            .update({ referral_code: code })
            .eq('id', session.user.id);
        }

        // Check for referral code in localStorage or sessionStorage and apply it
        const referralCode = localStorage.getItem('p4no-referral-code') || sessionStorage.getItem('sm-referral-code');
        if (referralCode) {
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('referred_by')
              .eq('id', session.user.id)
              .maybeSingle();

            if (profileData && !profileData.referred_by) {
              const { data: referrer } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('referral_code', referralCode)
                .maybeSingle();

              if (referrer && referrer.id !== session.user.id) {
                await supabase.from('referrals').insert({
                  referrer_id: referrer.id,
                  referred_user_id: session.user.id,
                  referral_code: referralCode,
                  status: 'pending',
                  is_valid: true,
                });

                await supabase
                  .from('profiles')
                  .update({ referred_by: referralCode })
                  .eq('id', session.user.id);

                await supabase.from('notifications').insert({
                  user_id: referrer.id,
                  title: 'New Referral! 🎉',
                  message: `Someone used your referral code "${referralCode}" via Google sign-in. Waiting for activation requirements.`,
                  type: 'referral',
                });
              }
            }
            localStorage.removeItem('p4no-referral-code');
            localStorage.removeItem('p4no-referrer-name');
            sessionStorage.removeItem('sm-referral-code');
            sessionStorage.removeItem('sm-referrer-name');
          } catch (refErr) {
            console.error('[p4no] Referral apply error:', refErr);
          }
        }

        navigate('/');
      } catch (err) {
        console.error('[p4no] Callback fatal error:', err);
        setErrorType('auth');
        setErrorDetail('An unexpected error occurred. Please try again.');
      }
    };

    handleCallback();
  }, [navigate]);

  const handleRetry = () => {
    navigate('/auth');
  };

  if (errorType) {
    const icons = {
      network: <WifiOff className="h-12 w-12 text-muted-foreground" />,
      config: <AlertTriangle className="h-12 w-12 text-primary" />,
      auth: <AlertTriangle className="h-12 w-12 text-destructive" />,
    };
    const titles = {
      network: 'Connection Failed',
      config: 'Configuration Error',
      auth: 'Authentication Failed',
    };

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-sm">
          <div className="flex justify-center mb-2">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
              <ShoppingBag className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-foreground">p4no</h2>
          <div className="flex justify-center">{icons[errorType]}</div>
          <div>
            <h3 className="text-xl font-semibold text-foreground">{titles[errorType]}</h3>
            <p className="text-sm text-muted-foreground mt-2">
              We couldn't verify your account. Please try again.
            </p>
            <p className="text-xs text-muted-foreground mt-1">{errorDetail}</p>
          </div>
          <Button onClick={handleRetry} className="w-full h-12 rounded-xl font-semibold gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')} className="w-full text-muted-foreground">
            Continue as Guest
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
            <ShoppingBag className="h-7 w-7 text-primary-foreground" />
          </div>
        </div>
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-base font-medium text-foreground">{status}</p>
        <p className="text-sm text-muted-foreground">Please wait...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
