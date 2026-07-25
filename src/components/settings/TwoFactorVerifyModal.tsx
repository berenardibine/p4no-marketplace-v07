import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Loader2, AlertTriangle, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { verifyTOTP } from "@/lib/totp";

interface TwoFactorVerifyModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  userId: string;
  title?: string;
  description?: string;
}

const TwoFactorVerifyModal = ({ 
  open, onClose, onVerified, userId,
  title = "Two-Factor Authentication",
  description = "Enter the 6-digit code from your authenticator app to continue."
}: TwoFactorVerifyModalProps) => {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCode('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Lockout timer
  useEffect(() => {
    if (lockTimer > 0) {
      const interval = setInterval(() => setLockTimer(t => t - 1), 1000);
      return () => clearInterval(interval);
    } else if (locked && lockTimer === 0) {
      setLocked(false);
      setAttempts(0);
    }
  }, [lockTimer, locked]);

  const handleVerify = async () => {
    if (code.length !== 6 || locked) return;
    
    setLoading(true);
    try {
      // Fetch the user's secret key
      const { data: security, error } = await supabase
        .from('user_security')
        .select('secret_key')
        .eq('user_id', userId)
        .eq('two_factor_enabled', true)
        .single();

      if (error || !security?.secret_key) {
        toast({ title: "2FA not configured", variant: "destructive" });
        setLoading(false);
        return;
      }

      const isValid = verifyTOTP(code, security.secret_key);

      if (isValid) {
        // Update last verified timestamp
        await supabase
          .from('user_security')
          .update({ 
            last_2fa_verified_at: new Date().toISOString(),
            session_expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days
          })
          .eq('user_id', userId);

        setAttempts(0);
        onVerified();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setCode('');
        
        if (newAttempts >= 5) {
          setLocked(true);
          setLockTimer(60); // Lock for 60 seconds
          toast({ 
            title: "Too many attempts", 
            description: "Please wait 60 seconds before trying again.",
            variant: "destructive" 
          });
        } else {
          toast({ 
            title: "Invalid code", 
            description: `Code is incorrect or expired. ${5 - newAttempts} attempts remaining.`,
            variant: "destructive" 
          });
        }
      }
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">{description}</p>

          {locked && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-xl text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Locked for {lockTimer}s due to too many failed attempts.</span>
            </div>
          )}

          <div className="space-y-2">
            <Input
              ref={inputRef}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleVerify(); }}
              maxLength={6}
              className="text-center text-3xl tracking-[0.5em] font-mono h-14"
              disabled={locked}
              autoComplete="one-time-code"
            />
            <p className="text-xs text-muted-foreground text-center">
              Code refreshes every 30 seconds
            </p>
          </div>

          <Button 
            onClick={handleVerify} 
            disabled={loading || code.length !== 6 || locked}
            className="w-full h-12"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Verify
          </Button>

          {/* Contact Support - for users who lost access to their 2FA code */}
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground text-center mb-2">
              Lost access to your authenticator app?
            </p>
            <Button
              variant="outline"
              className="w-full gap-2 rounded-xl"
              onClick={() => {
                window.open('https://wa.me/250788601632?text=I%20lost%20access%20to%20my%202FA%20code%20and%20need%20help%20accessing%20my%20p4no%20account.', '_blank');
              }}
            >
              <MessageCircle className="h-4 w-4" />
              Contact Support
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TwoFactorVerifyModal;
