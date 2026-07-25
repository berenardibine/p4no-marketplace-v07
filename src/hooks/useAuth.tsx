import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  user_type: string;
  phone_number: string | null;
  call_number: string | null;
  whatsapp_number: string | null;
  province_id: string | null;
  district_id: string | null;
  sector_id: string | null;
  profile_image: string | null;
  status: string | null;
  blocking_reason: string | null;
  referral_code: string | null;
  // Global location fields
  country: string | null;
  country_code: string | null;
  currency_code: string | null;
  currency_symbol: string | null;
  // GPS fields
  lat: number | null;
  lng: number | null;
  city: string | null;
  region: string | null;
  last_location_update: string | null;
  identity_verified?: boolean | null;
  is_verified?: boolean | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (data: SignUpData) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (password: string) => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
}

interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  userType: 'buyer' | 'seller';
  phoneNumber?: string;
  callNumber?: string;
  whatsappNumber?: string;
  provinceId?: string;
  districtId?: string;
  sectorId?: string;
  // Global location fields
  country?: string;
  countryCode?: string;
  currencyCode?: string;
  currencySymbol?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (!error && data) {
      const profileData = data as Profile;
      setProfile(profileData);
      
      // Auto-generate referral code if missing
      if (!profileData.referral_code) {
        const code = 'P4' + Math.random().toString(36).substring(2, 8).toUpperCase();
        supabase
          .from('profiles')
          .update({ referral_code: code })
          .eq('id', userId)
          .then(() => {
            setProfile(prev => prev ? { ...prev, referral_code: code } : prev);
          });
      }
      
      // Check if user is blocked/banned and redirect
      if (profileData.status === 'blocked' || profileData.status === 'banned') {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setProfile(null);
        
        localStorage.setItem('blocked_reason', profileData.blocking_reason || 'Violation of terms');
        localStorage.setItem('blocked_status', profileData.status);
        
        return { blocked: true };
      }
      return { blocked: false };
    }
    return { blocked: false };
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Use setTimeout to avoid potential deadlock with Supabase client
          setTimeout(async () => {
            const result = await fetchProfile(session.user.id);
            if (result?.blocked) {
              // User was blocked, redirect to blocked page
              window.location.href = '/blocked';
              return;
            }
            
            // Check 2FA session expiry (auto-logout after 3 days)
            const { data: security } = await supabase
              .from('user_security')
              .select('two_factor_enabled, session_expires_at')
              .eq('user_id', session.user.id)
              .eq('two_factor_enabled', true)
              .maybeSingle();
            
            if (security?.session_expires_at) {
              const expiresAt = new Date(security.session_expires_at);
              if (new Date() > expiresAt) {
                // Session expired, sign out
                await supabase.auth.signOut();
                setUser(null);
                setSession(null);
                setProfile(null);
                return;
              }
            }
          }, 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const result = await fetchProfile(session.user.id);
        if (result?.blocked) {
          window.location.href = '/blocked';
        }
      }
      setLoading(false);
    });

    // Set up realtime subscription to profile changes for blocking
    let profileSubscription: any = null;
    
    const setupProfileSubscription = (userId: string) => {
      profileSubscription = supabase
        .channel(`profile-changes-${userId}-${Math.random().toString(36).slice(2, 10)}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${userId}`
          },
          async (payload) => {
            const updatedProfile = payload.new as Profile;
            
            // Check if user was just blocked
            if (updatedProfile.status === 'blocked' || updatedProfile.status === 'banned') {
              localStorage.setItem('blocked_reason', updatedProfile.blocking_reason || 'Violation of terms');
              localStorage.setItem('blocked_status', updatedProfile.status);
              
              // Sign out and redirect
              await supabase.auth.signOut();
              setUser(null);
              setSession(null);
              setProfile(null);
              window.location.href = '/blocked';
            } else {
              setProfile(updatedProfile);
            }
          }
        )
        .subscribe();
    };

    // Subscribe to profile changes when user is authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setupProfileSubscription(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (profileSubscription) {
        supabase.removeChannel(profileSubscription);
      }
    };
  }, []);

  const signUp = async (data: SignUpData) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: data.fullName,
          user_type: data.userType,
          phone_number: data.phoneNumber || null,
          call_number: data.callNumber || null,
          whatsapp_number: data.whatsappNumber || null,
          province_id: data.provinceId || null,
          district_id: data.districtId || null,
          sector_id: data.sectorId || null,
          country: data.country || null,
          country_code: data.countryCode || null,
          currency_code: data.currencyCode || null,
          currency_symbol: data.currencySymbol || null,
        }
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // Check if user is blocked after successful sign in
    if (!error && data.user) {
      const result = await fetchProfile(data.user.id);
      if (result?.blocked) {
        return { error: { message: 'Your account has been blocked. Please contact support.' } };
      }
      // Profile completion is enforced by <ProfileCompletionGuard /> after sign-in
      // (it redirects to /complete-profile instead of blocking the login itself).
    }
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Hook to protect actions for guests - redirects to auth page
export const useAuthAction = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const withAuth = (action: () => void) => {
    if (!user && !loading) {
      navigate('/auth');
      return;
    }
    action();
  };

  return { withAuth, isAuthenticated: !!user };
};
