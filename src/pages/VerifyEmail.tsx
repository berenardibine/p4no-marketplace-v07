import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const VerifyEmail = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [countdown, setCountdown] = useState(120); // 2 minutes
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleResendEmail = async () => {
    setResending(true);
    
    // Get user email from session or storage
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email;
    
    if (!email) {
      toast({
        title: 'Error',
        description: 'Could not find your email. Please try signing up again.',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      toast({
        title: 'Failed to resend',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Email sent!',
        description: 'Check your inbox for the verification link.',
      });
      setCountdown(120);
      setCanResend(false);
    }
    setResending(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/auth')} className="p-2 hover:bg-muted rounded-full transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-semibold">Verify Email</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          {/* Icon Animation */}
          <div className="relative mx-auto w-24 h-24 mb-8">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
            <div className="relative w-full h-full bg-gradient-primary rounded-full flex items-center justify-center">
              <Mail className="h-10 w-10 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-3">
            Check Your Email
          </h1>
          <p className="text-muted-foreground mb-8">
            We've sent a verification link to your email address. Click the link to verify your account.
          </p>

          {/* Countdown Timer */}
          <div className="bg-muted/50 rounded-2xl p-6 mb-6">
            {!canResend ? (
              <>
                <p className="text-sm text-muted-foreground mb-2">
                  Resend available in
                </p>
                <div className="text-3xl font-bold text-primary">
                  {formatTime(countdown)}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">You can resend now</span>
              </div>
            )}
          </div>

          <Button
            onClick={handleResendEmail}
            disabled={!canResend || resending}
            variant={canResend ? "default" : "outline"}
            className={`w-full h-12 rounded-xl ${canResend ? 'bg-gradient-primary' : ''}`}
          >
            {resending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Resend Verification Email
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground mt-6">
            Didn't receive the email? Check your spam folder or try again.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
