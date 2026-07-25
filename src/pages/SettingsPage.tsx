import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Bell, Moon, Sun, Globe, Lock, 
  Trash2, ChevronRight, Shield, Eye, Smartphone, LogOut,
  MapPin, Loader2
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TwoFactorSetupModal from "@/components/settings/TwoFactorSetupModal";
import TwoFactorVerifyModal from "@/components/settings/TwoFactorVerifyModal";
import ConnectedDevicesModal from "@/components/settings/ConnectedDevicesModal";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const { preferences, loading, updatePreference } = useUserPreferences();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showDevicesModal, setShowDevicesModal] = useState(false);
  const [showDisable2FAVerify, setShowDisable2FAVerify] = useState(false);
  
  // Guest dark mode from localStorage
  const [guestDarkMode, setGuestDarkMode] = useState(() => {
    return theme === 'dark';
  });
  const [countryFilterEnabled, setCountryFilterEnabled] = useState(() => {
    return localStorage.getItem('p4no_country_filter') === 'true';
  });

  const isGuest = !user;

  // Show loading only while auth is resolving (brief)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="sticky top-0 z-50 bg-background border-b">
          <div className="flex items-center gap-3 p-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-semibold text-lg">Settings</h1>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const isSeller = profile?.user_type === 'seller';

  const handleToggle = (key: string, checked: boolean) => {
    if (!preferences) return;

    if (key === 'dark_mode') {
      const newTheme = checked ? 'dark' : 'light';
      setTheme(newTheme);
      updatePreference('dark_mode', checked);
      updatePreference('theme' as any, newTheme);
      return;
    }

    if (key === 'two_factor_enabled') {
      if (checked && !preferences.two_factor_enabled) {
        setShow2FAModal(true);
        return;
      }
      if (!checked && preferences.two_factor_enabled) {
        setShowDisable2FAVerify(true);
        return;
      }
    }

    updatePreference(key as any, checked);
  };

  const handleGuestDarkMode = (checked: boolean) => {
    setGuestDarkMode(checked);
    setTheme(checked ? 'dark' : 'light');
  };

  const handleCountryFilterToggle = (checked: boolean) => {
    setCountryFilterEnabled(checked);
    localStorage.setItem('p4no_country_filter', checked ? 'true' : 'false');
    if (!isGuest) {
      updatePreference('show_online_status' as any, preferences?.show_online_status ?? true);
    }
    toast({
      title: checked ? "Country filter enabled" : "Country filter disabled",
      description: checked 
        ? "You'll only see products from your detected country." 
        : "You'll see products from all countries.",
    });
    window.dispatchEvent(new Event('countryFilterChanged'));
  };

  const handleDeleteAccount = () => {
    toast({ title: "Coming Soon", description: "Account deletion will be available soon." });
    setShowDeleteDialog(false);
  };

  const handleLogout = async () => {
    await signOut();
    toast({ title: "Logged out", description: "You have logged out successfully." });
    navigate('/');
  };

  // Build sections based on guest vs authenticated
  const guestSections = [
    {
      title: "Appearance",
      items: [
        {
          icon: guestDarkMode ? Moon : Sun,
          label: "Dark Mode",
          description: "Switch between light and dark theme",
          type: "guest_toggle" as const,
          value: guestDarkMode,
          onToggle: handleGuestDarkMode,
        },
      ]
    },
    {
      title: "Location & Products",
      items: [
        {
          icon: MapPin,
          label: "Show Only My Country",
          description: "Filter products to show only from your detected country",
          type: "custom_toggle" as const,
          value: countryFilterEnabled,
        },
      ]
    },
  ];

  const authSections = [
    {
      title: "Notifications",
      items: [
        {
          icon: Bell,
          label: "Notification Preferences",
          description: "Choose which push notifications you receive",
          type: "link" as const,
          href: "/settings/notifications"
        },
        {
          icon: Bell,
          label: "Push Notifications",
          description: "Receive push notifications",
          key: "push_notifications",
          type: "toggle" as const,
          value: preferences?.push_notifications ?? true
        },
        {
          icon: Bell,
          label: "Email Notifications",
          description: "Receive email updates",
          key: "email_notifications",
          type: "toggle" as const,
          value: preferences?.email_notifications ?? true
        },
      ]
    },
    {
      title: "Appearance",
      items: [
        {
          icon: preferences?.dark_mode ? Moon : Sun,
          label: "Dark Mode",
          description: "Switch between light and dark theme",
          key: "dark_mode",
          type: "toggle" as const,
          value: preferences?.dark_mode ?? false
        },
        {
          icon: Globe,
          label: "Language",
          description: preferences?.language || "English",
          type: "link" as const,
          href: "/settings/language"
        },
      ]
    },
    {
      title: "Location & Products",
      items: [
        {
          icon: MapPin,
          label: "Show Only My Country",
          description: "Filter products to show only from your detected country",
          type: "custom_toggle" as const,
          value: countryFilterEnabled,
        },
      ]
    },
    {
      title: "Privacy & Security",
      items: [
        ...(isSeller ? [{
          icon: Lock,
          label: "Two-Factor Authentication",
          description: preferences?.two_factor_enabled 
            ? "Enabled - Your account is secured" 
            : "Add extra security to your account",
          key: "two_factor_enabled",
          type: "toggle" as const,
          value: preferences?.two_factor_enabled ?? false
        }] : []),
        {
          icon: Eye,
          label: "Show Online Status",
          description: "Let others see when you're online",
          key: "show_online_status",
          type: "toggle" as const,
          value: preferences?.show_online_status ?? true
        },
        {
          icon: Shield,
          label: "Privacy Settings",
          description: "Manage your privacy preferences",
          type: "link" as const,
          href: "/settings/privacy"
        },
      ]
    },
    {
      title: "Account",
      items: [
        {
          icon: Smartphone,
          label: "Connected Devices",
          description: "Manage devices logged into your account",
          type: "action" as const,
          action: () => setShowDevicesModal(true)
        },
        {
          icon: Trash2,
          label: "Delete Account",
          description: "Permanently delete your account",
          type: "danger" as const,
          action: () => setShowDeleteDialog(true)
        },
      ]
    }
  ];

  const settingSections = isGuest ? guestSections : authSections;

  // Show preferences loading only for authenticated users
  if (!isGuest && loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="sticky top-0 z-50 bg-background border-b">
          <div className="flex items-center gap-3 p-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-semibold text-lg">Settings</h1>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-semibold text-lg">Settings</h1>
        </div>
      </div>

      {/* Guest Banner */}
      {isGuest && (
        <div className="px-4 pt-4">
          <div className="bg-primary/10 rounded-2xl p-4 border border-primary/20">
            <p className="text-sm text-muted-foreground mb-2">Sign in to access all settings</p>
            <Button onClick={() => navigate('/auth')} size="sm" className="rounded-xl">
              Sign In
            </Button>
          </div>
        </div>
      )}

      <div className="p-4 space-y-6">
        {settingSections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">
              {section.title}
            </h3>
            <div className="bg-card rounded-2xl border overflow-hidden divide-y divide-border">
              {section.items.map((item: any, itemIndex: number) => (
                <div 
                  key={itemIndex}
                  className={cn(
                    "flex items-center gap-4 p-4",
                    (item.type === 'link' || item.type === 'danger' || item.type === 'action') && 
                    "cursor-pointer hover:bg-accent transition-colors"
                  )}
                  onClick={() => {
                    if (item.type === 'link' && item.href) navigate(item.href);
                    if ((item.type === 'danger' || item.type === 'action') && item.action) item.action();
                  }}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    item.type === 'danger' ? "bg-destructive/10" : "bg-muted"
                  )}>
                    <item.icon className={cn(
                      "h-5 w-5",
                      item.type === 'danger' ? "text-destructive" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="flex-1">
                    <p className={cn(
                      "font-medium",
                      item.type === 'danger' && "text-destructive"
                    )}>{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  {item.type === 'toggle' && item.key && (
                    <Switch
                      checked={item.value}
                      onCheckedChange={(checked) => handleToggle(item.key!, checked)}
                    />
                  )}
                  {item.type === 'guest_toggle' && (
                    <Switch
                      checked={item.value}
                      onCheckedChange={item.onToggle}
                    />
                  )}
                  {item.type === 'custom_toggle' && (
                    <Switch
                      checked={item.value}
                      onCheckedChange={handleCountryFilterToggle}
                    />
                  )}
                  {(item.type === 'link' || item.type === 'action') && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Logout Button - only for authenticated */}
      {!isGuest && (
        <div className="px-4 mt-2">
          <Button 
            onClick={() => setShowLogoutDialog(true)}
            variant="outline" 
            className="w-full h-12 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/5 gap-2"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </Button>
        </div>
      )}

      {/* App Version */}
      <div className="px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">p4no v1.0.0</p>
      </div>

      {/* Modals - only render for authenticated */}
      {!isGuest && (
        <>
          <TwoFactorSetupModal
            open={show2FAModal}
            onClose={() => setShow2FAModal(false)}
            onSuccess={() => {}}
          />
          <ConnectedDevicesModal
            open={showDevicesModal}
            onClose={() => setShowDevicesModal(false)}
          />
          <TwoFactorVerifyModal
            open={showDisable2FAVerify}
            onClose={() => setShowDisable2FAVerify(false)}
            onVerified={async () => {
              setShowDisable2FAVerify(false);
              await supabase
                .from('user_security')
                .update({ two_factor_enabled: false, secret_key: null })
                .eq('user_id', user!.id);
              await supabase
                .from('user_preferences')
                .update({ two_factor_enabled: false })
                .eq('user_id', user!.id);
              updatePreference('two_factor_enabled' as any, false);
              toast({ title: "Two-factor authentication disabled" });
            }}
            userId={user!.id}
            title="Confirm Disable 2FA"
            description="Enter your authenticator code to confirm disabling two-factor authentication."
          />
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Account</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete your account permanently? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive hover:bg-destructive/90">
                  Delete Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Logout</AlertDialogTitle>
                <AlertDialogDescription>Are you sure you want to log out?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleLogout}>Logout</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
};

export default SettingsPage;
