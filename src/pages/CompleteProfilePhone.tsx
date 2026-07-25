import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ArrowLeft, ShoppingBag, CheckCircle, User, Sparkles, Shield, Loader2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import SmartPhoneInput from '@/components/auth/SmartPhoneInput';
import { isValidPhoneNumber } from 'react-phone-number-input';
import { useGeo } from '@/context/GeoContext';

const CompleteProfilePhone = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const { isSeller, isBuyer, loading: rolesLoading } = useUserRoles();
  const { toast } = useToast();
  const geo = useGeo();

  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [callNumber, setCallNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [sameNumber, setSameNumber] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth', { replace: true });
  }, [user, authLoading, navigate]);

  // Prefill from existing profile
  useEffect(() => {
    if (profile) {
      if (profile.full_name) setFullName(profile.full_name);
      if (profile.call_number) setCallNumber(profile.call_number);
      if (profile.whatsapp_number) {
        setWhatsappNumber(profile.whatsapp_number);
        if (profile.call_number && profile.whatsapp_number !== profile.call_number) setSameNumber(false);
      }
    }
  }, [profile]);

  const isValidPhone = (p: string) => !!p && isValidPhoneNumber(p);
  const sellerMode = isSeller;

  // Detected country (IP-based via GeoContext) with profile fallback
  const detectedCountry = profile?.country || geo.country || '';
  const detectedCountryCode = (profile as any)?.country_code || geo.countryCode || '';

  // Live progress
  const progress = useMemo(() => {
    const required: boolean[] = [
      !!fullName.trim(),
      isValidPhone(callNumber),
      !!detectedCountry,
    ];
    if (sellerMode) required.push(isValidPhone(sameNumber ? callNumber : whatsappNumber));
    const filled = required.filter(Boolean).length;
    return Math.round((filled / required.length) * 100);
  }, [fullName, callNumber, whatsappNumber, sameNumber, sellerMode, detectedCountry]);

  const canSubmit = useMemo(() => {
    if (!fullName.trim()) return false;
    if (!isValidPhone(callNumber)) return false;
    if (sellerMode && !isValidPhone(sameNumber ? callNumber : whatsappNumber)) return false;
    return true;
  }, [fullName, callNumber, whatsappNumber, sameNumber, sellerMode]);

  const handleCallChange = (v: string) => {
    setCallNumber(v);
    if (sameNumber) setWhatsappNumber(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!canSubmit) {
      toast({ title: 'Please complete required fields', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      // Make sure session is fully ready (prevents RLS errors right after OAuth)
      let { data: { session } } = await supabase.auth.getSession();
      for (let i = 0; i < 10 && !session?.user?.id; i++) {
        await new Promise((r) => setTimeout(r, 200));
        ({ data: { session } } = await supabase.auth.getSession());
      }
      if (!session?.user?.id) {
        toast({ title: 'Session not ready', description: 'Please sign in again.', variant: 'destructive' });
        navigate('/auth', { replace: true });
        return;
      }

      const callTrim = callNumber.trim();
      const whatsapp = (sellerMode ? (sameNumber ? callNumber : whatsappNumber) : callNumber).trim();

      // Pre-check phone uniqueness to give a friendly error instead of a DB constraint crash
      const { data: existingCall } = await supabase
        .from('profiles')
        .select('id')
        .or(`call_number.eq.${callTrim},phone_number.eq.${callTrim}`)
        .neq('id', user.id)
        .limit(1)
        .maybeSingle();
      if (existingCall) {
        toast({ title: 'Phone number already used', description: 'This number is registered to another account.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const update: any = {
        full_name: fullName.trim(),
        call_number: callTrim,
        phone_number: callTrim,
        whatsapp_number: whatsapp,
      };
      if (sellerMode && businessName.trim()) update.business_name = businessName.trim();
      // Save detected country / currency so profile completion check passes
      if (geo.country) update.country = geo.country;
      if (geo.countryCode) update.country_code = geo.countryCode;
      if (geo.currencyCode) update.currency_code = geo.currencyCode;
      if (geo.currencySymbol) update.currency_symbol = geo.currencySymbol;
      if (geo.ip) update.detected_ip = geo.ip;

      const { error } = await supabase.from('profiles').update(update).eq('id', session.user.id);
      if (error) throw error;

      await refreshProfile();
      toast({ title: 'Profile completed!', description: 'Welcome to P4NO 🎉' });
      // Hard navigate to avoid the in-page useEffect bouncing while profile state propagates
      window.location.replace(sellerMode ? '/seller-dashboard' : '/reels');
    } catch (err: any) {
      toast({ title: 'Could not save', description: err.message || 'Try again.', variant: 'destructive' });
      setLoading(false);
    }
  };


  if (authLoading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-amber-500/5 safe-top safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-foreground">Complete Profile</span>
          </div>
          <div className="w-9" />
        </div>
      </div>

      <div className="container max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Hero */}
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shadow-orange">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">
            {sellerMode ? 'Set up your seller profile' : 'Almost there!'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {sellerMode
              ? 'Buyers need to reach you. Add the essentials to start selling.'
              : 'Add your name and a phone number so sellers can reach you.'}
          </p>
        </div>

        {/* Progress */}
        <div className="rounded-2xl border border-border/50 bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Profile completion</span>
            <span className="text-xs font-bold text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name *</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Aline Uwase"
                className="pl-10 h-12 rounded-xl"
                required
              />
            </div>
          </div>

          {/* Business name (seller only, optional) */}
          {sellerMode && (
            <div className="space-y-2">
              <Label htmlFor="business">Business / shop name <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="business"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Aline's Boutique"
                className="h-12 rounded-xl"
              />
            </div>
          )}

          {/* Call number */}
          <div className="space-y-2">
            <Label htmlFor="call-number">Phone number *</Label>
            <SmartPhoneInput
              id="call-number"
              value={callNumber}
              onChange={handleCallChange}
              placeholder="Your phone number"
            />
          </div>

          {/* WhatsApp (seller only) */}
          {sellerMode && (
            <>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sameNumber}
                  onChange={(e) => {
                    setSameNumber(e.target.checked);
                    if (e.target.checked) setWhatsappNumber(callNumber);
                  }}
                  className="rounded border-border h-4 w-4 accent-primary"
                />
                <span className="text-sm text-foreground">WhatsApp is the same number</span>
              </label>

              {!sameNumber && (
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-number">WhatsApp number *</Label>
                  <SmartPhoneInput
                    id="whatsapp-number"
                    value={whatsappNumber}
                    onChange={setWhatsappNumber}
                    placeholder="WhatsApp number"
                    showHint={false}
                  />
                </div>
              )}
            </>
          )}

          {/* Country (auto-detected via IP) */}
          <div className="space-y-2">
            <Label htmlFor="country">Country *</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="country"
                value={geo.loading ? 'Detecting…' : (detectedCountry || 'Unknown')}
                readOnly
                className="pl-10 h-12 rounded-xl bg-muted/30"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              🌍 Auto-detected from your location{detectedCountryCode ? ` (${detectedCountryCode})` : ''}.
            </p>
          </div>

          <Button
            type="submit"
            className="w-full h-12 font-bold rounded-xl bg-gradient-to-r from-primary to-orange-500 hover:opacity-95 shadow-orange"
            disabled={loading || !canSubmit}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><CheckCircle className="h-4 w-4 mr-2" /> Save & Continue</>
            )}
          </Button>

          <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-emerald-500" />
            Your data is encrypted and never shared without consent.
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompleteProfilePhone;
