import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mail, User, Phone, Store, ArrowLeft, Globe, Loader2, Gift, ShoppingBag,
  Sparkles, Check, Shield, LogIn, UserPlus, Heart, MessageCircle, Bell,
  BarChart3, Rocket, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useGeo } from '@/context/GeoContext';
import PasswordInput, { validatePassword } from '@/components/auth/PasswordInput';
import CountrySelect from '@/components/location/CountrySelect';
import { Country } from '@/hooks/useCountries';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import TermsModal from '@/components/auth/TermsModal';
import TwoFactorVerifyModal from '@/components/settings/TwoFactorVerifyModal';

type Mode = 'signin' | 'signup';
type AccountKind = 'buyer' | 'seller';

const buyerFeatures = [
  { Icon: ShoppingBag, label: 'Browse products & services' },
  { Icon: Heart, label: 'Follow & save favorites' },
  { Icon: MessageCircle, label: 'Comment, rate & report' },
  { Icon: Bell, label: 'Personalized alerts' },
];

const sellerFeatures = [
  { Icon: Store, label: 'Create shop & list products' },
  { Icon: MessageSquare, label: 'WhatsApp orders & chat' },
  { Icon: BarChart3, label: 'Analytics & insights' },
  { Icon: Rocket, label: 'Boost visibility & earn' },
];

const GoogleIcon = ({ className = '' }: { className?: string }) => (
  <svg className={cn('h-5 w-5', className)} viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const Auth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, signUp, signIn } = useAuth();
  const { toast } = useToast();
  const { countries, countryCode } = useGeo();

  const initialMode = (params.get('mode') === 'signup' ? 'signup' : 'signin') as Mode;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [accountKind, setAccountKind] = useState<AccountKind>('buyer');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Common
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [referralCode, setReferralCode] = useState('');

  // Seller extras
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [callNumber, setCallNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');

  const [showTerms, setShowTerms] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [pending2FAUserId, setPending2FAUserId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('p4no-referral-code') || sessionStorage.getItem('sm-referral-code');
    if (stored) setReferralCode(stored);
  }, []);

  useEffect(() => {
    if (countryCode && countries.length > 0 && !selectedCountry) {
      const found = countries.find(c => c.iso_code === countryCode);
      if (found) {
        setSelectedCountry(found);
        if (found.phone_code && !callNumber) {
          setCallNumber(found.phone_code + ' ');
          setWhatsappNumber(found.phone_code + ' ');
        }
      }
    }
  }, [countryCode, countries]);

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast({ title: 'Google sign in failed', description: error.message, variant: 'destructive' });
      setGoogleLoading(false);
    }
  };

  const handleCountryChange = (country: Country) => {
    setSelectedCountry(country);
    if (country.phone_code) {
      const currentCall = callNumber.replace(/^\+\d+\s*/, '');
      const currentWhatsapp = whatsappNumber.replace(/^\+\d+\s*/, '');
      setCallNumber(`${country.phone_code} ${currentCall}`);
      setWhatsappNumber(`${country.phone_code} ${currentWhatsapp}`);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast({ title: 'Sign in failed', description: error.message || 'Invalid email or password', variant: 'destructive' });
      setLoading(false);
      return;
    }
    const { data: { user: signedInUser } } = await supabase.auth.getUser();
    if (signedInUser) {
      const { data: security } = await supabase
        .from('user_security')
        .select('two_factor_enabled')
        .eq('user_id', signedInUser.id)
        .eq('two_factor_enabled', true)
        .maybeSingle();
      if (security?.two_factor_enabled) {
        await supabase.from('user_security')
          .update({ last_2fa_verified_at: null, session_expires_at: null })
          .eq('user_id', signedInUser.id);
        setPending2FAUserId(signedInUser.id);
        setShow2FA(true);
        setLoading(false);
        return;
      }
    }
    toast({ title: 'Welcome back!' });
    navigate('/');
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePassword(password)) {
      toast({ title: 'Invalid password', description: 'Please meet all password requirements.', variant: 'destructive' });
      return;
    }
    if (!fullName || !email) {
      toast({ title: 'Missing fields', variant: 'destructive' });
      return;
    }
    if (accountKind === 'seller') {
      if (!selectedCountry) {
        toast({ title: 'Country required', variant: 'destructive' });
        return;
      }
      if (!callNumber || !whatsappNumber) {
        toast({ title: 'Contact numbers required', description: 'Sellers need both call and WhatsApp numbers.', variant: 'destructive' });
        return;
      }
    }
    setShowTerms(true);
  };

  const proceedWithSignUp = async () => {
    setShowTerms(false);
    setLoading(true);

    if (referralCode.trim()) {
      const { data: referrer } = await supabase
        .from('profiles').select('id').eq('referral_code', referralCode.trim()).maybeSingle();
      if (!referrer) {
        toast({ title: 'Invalid referral code', variant: 'destructive' });
        setLoading(false);
        return;
      }
    }

    const { error } = await signUp({
      email,
      password,
      fullName,
      userType: accountKind,
      ...(accountKind === 'seller'
        ? {
            phoneNumber: callNumber,
            callNumber,
            whatsappNumber,
            country: selectedCountry?.name,
            countryCode: selectedCountry?.iso_code,
            currencyCode: selectedCountry?.currency_code || 'USD',
            currencySymbol: selectedCountry?.currency_symbol || '$',
          }
        : {}),
    });

    if (error) {
      toast({ title: 'Sign up failed', description: error.message, variant: 'destructive' });
    } else {
      if (referralCode.trim()) localStorage.setItem('p4no-referral-code', referralCode.trim());
      navigate('/verify-email');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/85 backdrop-blur-xl border-b border-border/40 px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shadow-orange">
              <ShoppingBag className="h-4 w-4 text-white" />
            </div>
            <span className="font-extrabold text-lg text-foreground">P4no</span>
          </div>
          <div className="w-9" />
        </div>
      </div>

      <div className="container max-w-md mx-auto px-4 py-6">
        {/* Hero */}
        <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-orange-500 to-amber-500 p-6 text-white shadow-orange">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -left-6 -bottom-10 h-32 w-32 rounded-full bg-amber-300/30 blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs font-semibold border border-white/30">
              <Sparkles className="h-3 w-3" /> Join 10,000+ on P4NO
            </div>
            <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">
              {mode === 'signup' ? 'Join the future of social commerce.' : 'Welcome back to P4NO.'}
            </h1>
            <p className="mt-1.5 text-sm text-white/90">
              {mode === 'signup'
                ? 'Discover, follow and order — or grow your business globally.'
                : 'Sign in to your buyer or seller account.'}
            </p>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex p-1 bg-muted/60 rounded-2xl mb-6">
          {(['signin', 'signup'] as Mode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all',
                mode === m
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {m === 'signin' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Google */}
        <Button
          type="button"
          variant="outline"
          className="w-full h-12 rounded-2xl font-semibold gap-3 border-border/60 bg-card hover:bg-accent"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
        >
          {googleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </Button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50" /></div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-3 text-muted-foreground">or continue with email</span>
          </div>
        </div>

        {mode === 'signin' ? (
          <form onSubmit={handleSignIn} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="signin-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="signin-email" type="email" placeholder="you@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12 rounded-xl" required />
              </div>
            </div>
            <PasswordInput value={password} onChange={setPassword} id="signin-password" />

            <button type="button" onClick={() => navigate('/forgot-password')}
              className="text-sm text-primary hover:underline font-medium">
              Forgot password?
            </button>

            <Button type="submit" disabled={loading}
              className="w-full h-12 font-bold rounded-2xl bg-gradient-to-r from-primary to-orange-500 hover:opacity-95 shadow-orange gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {loading ? 'Signing in...' : 'Log In'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              New to P4NO?{' '}
              <button type="button" onClick={() => setMode('signup')} className="text-primary font-semibold hover:underline">
                Create a free account
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-5">
            {/* Educational comparison cards */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Choose your account
              </p>
              <div className="grid grid-cols-2 gap-2">
                <AccountCard
                  active={accountKind === 'buyer'}
                  onClick={() => setAccountKind('buyer')}
                  title="Buyer"
                  subtitle="Browse & order"
                  Icon={ShoppingBag}
                  gradient="from-blue-500 to-indigo-500"
                  features={buyerFeatures}
                />
                <AccountCard
                  active={accountKind === 'seller'}
                  onClick={() => setAccountKind('seller')}
                  title="Seller"
                  subtitle="Grow a business"
                  Icon={Store}
                  gradient="from-primary to-orange-500"
                  features={sellerFeatures}
                />
              </div>
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="fullName" type="text" placeholder="Your full name"
                  value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="pl-10 h-12 rounded-xl" required />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="signup-email" type="email" placeholder="you@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12 rounded-xl" required />
              </div>
            </div>

            {/* Password */}
            <PasswordInput value={password} onChange={setPassword} showRequirements id="signup-password" />

            {/* Seller-only fields */}
            {accountKind === 'seller' && (
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Your Country *</Label>
                  <CountrySelect
                    countries={countries}
                    value={selectedCountry?.iso_code || ''}
                    onChange={handleCountryChange}
                    placeholder="Select your country"
                    showCurrency showPhoneCode
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="callNumber">Call Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="callNumber" type="tel"
                      placeholder={`${selectedCountry?.phone_code || '+1'} XXX XXXX`}
                      value={callNumber} onChange={(e) => setCallNumber(e.target.value)}
                      className="pl-10 h-12 rounded-xl" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsappNumber">WhatsApp Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                    <Input id="whatsappNumber" type="tel"
                      placeholder={`${selectedCountry?.phone_code || '+1'} XXX XXXX`}
                      value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)}
                      className="pl-10 h-12 rounded-xl" required />
                  </div>
                </div>
              </>
            )}

            {/* Referral code */}
            <div className="space-y-2">
              <Label htmlFor="referralCode">Referral Code <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div className="relative">
                <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                <Input id="referralCode" value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  placeholder="P4XXXXXX"
                  className={cn('pl-10 h-12 rounded-xl', referralCode && 'border-primary/30 bg-primary/5')} />
              </div>
            </div>

            <Button type="submit" disabled={loading}
              className="w-full h-12 font-bold rounded-2xl bg-gradient-to-r from-primary to-orange-500 hover:opacity-95 shadow-orange gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {loading ? 'Creating account...' : `Create ${accountKind === 'seller' ? 'Seller' : 'Buyer'} Account`}
            </Button>

            <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5 text-emerald-500" />
              Secure account · Free forever · Cancel anytime
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <button type="button" onClick={() => setMode('signin')} className="text-primary font-semibold hover:underline">
                Log in
              </button>
            </p>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8">
          By continuing, you agree to our{' '}
          <a href="/page/terms" className="text-primary hover:underline">Terms</a>{' '}and{' '}
          <a href="/page/privacy" className="text-primary hover:underline">Privacy Policy</a>
        </p>
      </div>

      <TermsModal open={showTerms} onAccept={proceedWithSignUp} onCancel={() => setShowTerms(false)} />

      {pending2FAUserId && (
        <TwoFactorVerifyModal
          open={show2FA}
          onClose={async () => {
            setShow2FA(false);
            setPending2FAUserId(null);
            await supabase.auth.signOut();
            toast({ title: '2FA verification required', variant: 'destructive' });
          }}
          onVerified={() => {
            setShow2FA(false);
            setPending2FAUserId(null);
            toast({ title: 'Welcome back!' });
            navigate('/');
          }}
          userId={pending2FAUserId}
          title="Verify Your Identity"
          description="Enter the 6-digit code from your authenticator app."
        />
      )}
    </div>
  );
};

interface AccountCardProps {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  Icon: typeof ShoppingBag;
  gradient: string;
  features: { Icon: typeof ShoppingBag; label: string }[];
}

const AccountCard = ({ active, onClick, title, subtitle, Icon, gradient, features }: AccountCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'relative text-left p-3.5 rounded-2xl border-2 transition-all active:scale-[0.98]',
      active
        ? 'border-primary bg-primary/5 shadow-md'
        : 'border-border bg-card hover:border-primary/40'
    )}
  >
    {active && (
      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-orange">
        <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />
      </div>
    )}
    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm mb-2.5', gradient)}>
      <Icon className="h-5 w-5 text-white" />
    </div>
    <p className="font-bold text-foreground text-sm leading-tight">{title}</p>
    <p className="text-[11px] text-muted-foreground mb-2">{subtitle}</p>
    <ul className="space-y-1">
      {features.map(f => (
        <li key={f.label} className="flex items-start gap-1.5 text-[11px] text-foreground/80 leading-snug">
          <f.Icon className="h-3 w-3 text-primary mt-0.5 shrink-0" />
          <span>{f.label}</span>
        </li>
      ))}
    </ul>
  </button>
);

export default Auth;
