import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Store, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRoles } from '@/hooks/useUserRoles';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Choice = 'buyer' | 'seller' | 'both';

const options: { id: Choice; title: string; desc: string; features: string[]; Icon: typeof ShoppingBag; gradient: string }[] = [
  {
    id: 'buyer',
    title: 'Explore & Buy',
    desc: 'Discover, follow and order from sellers worldwide.',
    features: ['Browse products & reels', 'Follow shops & providers', 'Save favorites & order', 'Personalized feed & alerts'],
    Icon: ShoppingBag,
    gradient: 'from-blue-500 to-indigo-500',
  },
  {
    id: 'seller',
    title: 'Sell Products or Services',
    desc: 'Build a shop and grow a real business on P4NO.',
    features: ['Create shop & list products', 'Reach more customers', 'WhatsApp orders & analytics', 'Boost visibility & earn'],
    Icon: Store,
    gradient: 'from-primary to-orange-500',
  },
  {
    id: 'both',
    title: 'Both — Buy & Sell',
    desc: 'Unlock the complete P4NO experience.',
    features: ['Everything buyers get', 'Everything sellers get', 'Switch contexts anytime'],
    Icon: Sparkles,
    gradient: 'from-purple-500 to-pink-500',
  },
];

const OnboardingAccountType = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { roles, loading: rolesLoading, refetch } = useUserRoles();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState<Choice | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate('/auth', { replace: true });
  }, [user, loading, navigate]);

  // Skip onboarding if already has buyer/seller role
  useEffect(() => {
    if (!rolesLoading && (roles.includes('buyer') || roles.includes('seller'))) {
      const isSeller = roles.includes('seller');
      navigate(isSeller ? '/complete-profile/phone' : '/reels', { replace: true });
    }
  }, [roles, rolesLoading, navigate]);

  const choose = async (choice: Choice) => {
    setSubmitting(choice);
    try {
      // Wait for a valid authenticated session before any insert (prevents RLS errors)
      let { data: { session } } = await supabase.auth.getSession();
      // Retry briefly in case the session is still being attached (e.g. just after OAuth)
      for (let i = 0; i < 10 && !session?.user?.id; i++) {
        await new Promise((r) => setTimeout(r, 200));
        ({ data: { session } } = await supabase.auth.getSession());
      }
      const uid = session?.user?.id;
      if (!uid) {
        toast({ title: 'Session not ready', description: 'Please sign in again.', variant: 'destructive' });
        navigate('/auth', { replace: true });
        return;
      }

      const toInsert: Array<{ user_id: string; role: 'buyer' | 'seller' }> = [];
      if (choice === 'buyer' || choice === 'both') toInsert.push({ user_id: uid, role: 'buyer' });
      if (choice === 'seller' || choice === 'both') toInsert.push({ user_id: uid, role: 'seller' });

      const { error } = await supabase.from('user_roles').upsert(toInsert, { onConflict: 'user_id,role' });
      if (error) throw error;

      if (choice !== 'buyer') {
        await supabase.from('profiles').update({ user_type: 'seller' }).eq('id', uid);
      }
      await refetch();

      navigate('/complete-profile/phone', { replace: true });
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(null);
    }
  };

  if (loading || rolesLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      <div className="container max-w-md mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-orange-500 mx-auto mb-4 flex items-center justify-center">
            <Sparkles className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Welcome to P4NO</h1>
          <p className="text-sm text-muted-foreground mt-2">How do you want to use P4NO?</p>
        </div>

        <div className="space-y-3">
          {options.map(opt => (
            <button
              key={opt.id}
              onClick={() => choose(opt.id)}
              disabled={!!submitting}
              className={cn(
                'w-full text-left p-4 rounded-2xl border-2 border-border bg-card hover:border-primary/60 hover:shadow-lg transition-all',
                'active:scale-[0.99] group',
                submitting === opt.id && 'opacity-70 border-primary'
              )}
            >
              <div className="flex items-start gap-4">
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br shrink-0 shadow-md group-hover:scale-110 transition-transform', opt.gradient)}>
                  <opt.Icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-foreground">{opt.title}</p>
                    {submitting === opt.id
                      ? <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      : <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  <ul className="mt-3 grid grid-cols-1 gap-1.5">
                    {opt.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-xs text-foreground/80">
                        <span className={cn('w-1.5 h-1.5 rounded-full bg-gradient-to-br', opt.gradient)} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          You can change this anytime from your account settings.
        </p>
      </div>
    </div>
  );
};

export default OnboardingAccountType;
