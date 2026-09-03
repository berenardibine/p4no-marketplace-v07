import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User, Store, Heart, Settings, Phone, LogOut, LogIn,
  ChevronRight, Shield, Bell, HelpCircle, ArrowLeft, Home,
  FileText, ShieldCheck, ScrollText, Info, Briefcase, Newspaper,
  ListChecks, Wallet, Gift
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/useNotifications";
import { useCategories } from "@/hooks/useCategories";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface LegalDbPage {
  title: string;
  slug: string;
}

// All categories are now shown in menu

const MenuPage = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { toast } = useToast();
  const { unreadCount } = useNotifications();
  const { categories, loading: categoriesLoading } = useCategories();
  const [legalPages, setLegalPages] = useState<LegalDbPage[]>([]);

  // Show all categories
  const visibleCategories = categories;

  // Items visible to everyone (guests + authenticated)
  const publicMenuItems = [
    { icon: Briefcase, label: "P4NO Connect", href: "/connect", color: "bg-orange-500", badge: "NEW" },
    { icon: Newspaper, label: "P4NO Insights", href: "/insights", color: "bg-amber-600", badge: "NEW" },
  ];

  // Authenticated-only menu items
  const authMenuItems = [
    { icon: User, label: "My Account", href: "/account", color: "bg-blue-500" },
    { icon: Store, label: "My Shop", href: "/my-shop", sellerOnly: true, color: "bg-green-500" },
    { icon: ListChecks, label: "Tasks", href: "/tasks", color: "bg-cyan-500" },
    { icon: Wallet, label: "My Wallet", href: "/wallet", color: "bg-emerald-500" },
    { icon: Gift, label: "Refer & Earn", href: "/referrals", color: "bg-amber-500" },
    { icon: Heart, label: "Favorites", href: "/favorites", color: "bg-pink-500" },
    { icon: Bell, label: "Notifications", href: "/notifications", badgeCount: unreadCount, color: "bg-purple-500" },
  ];

  // Items visible to all users (guests + authenticated)
  const staticSupportItems = [
    { icon: Settings, label: "Settings", href: "/settings", color: "bg-slate-500" },
    { icon: HelpCircle, label: "Help Center", href: "/help", color: "bg-cyan-500" },
    { icon: Phone, label: "Contact Support", href: "/support", color: "bg-teal-500" },
  ];

  const legalFallbackOrder = [
    { slug: "about-us", label: "About Us" },
    { slug: "privacy-policy", label: "Privacy Policy" },
    { slug: "terms-and-condition", label: "Terms & Conditions" },
    { slug: "disclaimer", label: "Disclaimer" },
  ];

  const legalIconBySlug = {
    "about-us": Info,
    "privacy-policy": ShieldCheck,
    "terms-and-condition": ScrollText,
    disclaimer: FileText,
  };

  useEffect(() => {
    const fetchLegalPages = async () => {
      const slugs = legalFallbackOrder.map((item) => item.slug);
      const { data } = await supabase
        .from("site_pages")
        .select("title,slug")
        .in("slug", slugs)
        .eq("is_published", true);

      if (!data) {
        setLegalPages(legalFallbackOrder.map((item) => ({ title: item.label, slug: item.slug })));
        return;
      }

      const mapBySlug = new Map(data.map((page) => [page.slug, page.title]));
      const ordered = legalFallbackOrder
        .filter((item) => mapBySlug.has(item.slug))
        .map((item) => ({
          slug: item.slug,
          title: mapBySlug.get(item.slug) || item.label,
        }));

      setLegalPages(ordered.length > 0 ? ordered : legalFallbackOrder.map((item) => ({ title: item.label, slug: item.slug })));
    };

    fetchLegalPages();
  }, []);

  const filteredAuthItems = authMenuItems.filter(item => {
    if (item.sellerOnly && profile?.user_type !== 'seller') return false;
    return true;
  });

  const supportItems = useMemo(() => {
    const legalAsMenu = legalPages.map((page) => ({
      icon: legalIconBySlug[page.slug as keyof typeof legalIconBySlug] ?? FileText,
      label: page.title,
      href: `/${page.slug}`,
      color: "bg-primary",
    }));

    return [
      staticSupportItems[0],
      ...legalAsMenu,
      ...staticSupportItems.slice(1),
    ];
  }, [legalPages]);

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
    navigate('/');
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Guest';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary via-orange-500 to-amber-500 pt-safe pb-8 px-4">
        <div className="flex items-center gap-3 mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="font-semibold text-lg text-white">Menu</h1>
        </div>

        {user ? (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg border-2 border-white/30 overflow-hidden">
              {profile?.profile_image ? (
                <img src={profile.profile_image} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-2xl">{initials}</span>
              )}
            </div>
            <div className="flex-1">
              <p className="font-bold text-white text-lg">{displayName}</p>
              <p className="text-white/80 text-sm capitalize">{profile?.user_type || 'Member'}</p>
            </div>
            <button 
              onClick={() => navigate('/account')}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
            >
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <User className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-white text-lg">Welcome!</p>
              <p className="text-white/80 text-sm">Sign in to explore more</p>
            </div>
            <Button 
              onClick={() => navigate('/auth')}
              className="bg-white text-primary hover:bg-white/90"
            >
             Become seller/log in
            </Button>
          </div>
        )}
      </div>

      {/* Admin Button */}
      {isAdmin && (
        <div className="px-4 -mt-4 mb-4">
          <button
            onClick={() => navigate('/admin')}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg hover:shadow-xl transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <span className="flex-1 text-left font-semibold text-white text-lg">Admin Dashboard</span>
            <ChevronRight className="h-5 w-5 text-white/70" />
          </button>
        </div>
      )}

      {/* Home Link */}
      <div className="px-4 py-2">
        <button
          onClick={() => navigate('/')}
          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white bg-primary">
            <Home className="h-6 w-6" />
          </div>
          <span className="flex-1 text-left font-medium text-foreground group-hover:text-primary transition-colors text-base">
            Home
          </span>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>
      </div>

      {/* Discover (Connect + Insights) */}
      <div className="px-4 py-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">Discover</p>
        <div className="space-y-2">
          {publicMenuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.href)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border hover:shadow-md transition-all group"
            >
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white", item.color)}>
                <item.icon className="h-6 w-6" />
              </div>
              <span className="flex-1 text-left font-medium text-foreground group-hover:text-primary transition-colors text-base">
                {item.label}
              </span>
              {item.badge && (
                <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                  {item.badge}
                </span>
              )}
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Categories from Database (individual categories, excluding hidden types) */}
      <div className="px-4 py-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">Categories</p>
        <div className="space-y-2">
          {categoriesLoading ? (
            Array(4).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))
          ) : (
            visibleCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => navigate(`/category/${cat.slug}`)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 text-xl">
                  {cat.icon || '📦'}
                </div>
                <span className="flex-1 text-left font-medium text-foreground group-hover:text-primary transition-colors text-base">
                  {cat.name}
                </span>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Authenticated Menu Items */}
      {user && filteredAuthItems.length > 0 && (
        <div className="px-4 py-2">
          <div className="h-px bg-border my-2" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">Account</p>
          <div className="space-y-2">
            {filteredAuthItems.map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.href)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border hover:shadow-md transition-all group"
              >
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white", item.color)}>
                  <item.icon className="h-6 w-6" />
                </div>
                <span className="flex-1 text-left font-medium text-foreground group-hover:text-primary transition-colors text-base">
                  {item.label}
                </span>
                {'badgeCount' in item && item.badgeCount && item.badgeCount > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-red-500 text-white text-xs font-semibold min-w-[24px] text-center">
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </span>
                )}
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Support - visible to all */}
      <div className="px-4 py-2">
        <div className="h-px bg-border my-2" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">Support</p>
        <div className="space-y-2">
          {supportItems.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.href)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border hover:shadow-md transition-all group"
            >
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white", item.color)}>
                <item.icon className="h-6 w-6" />
              </div>
              <span className="flex-1 text-left font-medium text-foreground group-hover:text-primary transition-colors text-base">
                {item.label}
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Login/Logout */}
      <div className="px-4 mt-6">
        {user ? (
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center">
              <LogOut className="h-6 w-6 text-white" />
            </div>
            <span className="font-semibold text-red-600 dark:text-red-400 text-base">Logout</span>
          </button>
        ) : (
          <button 
            onClick={() => navigate('/auth')}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-primary to-orange-500 hover:opacity-90 transition-opacity shadow-lg"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <LogIn className="h-6 w-6 text-white" />
            </div>
            <span className="font-semibold text-white text-base">Become Seller/log in</span>
          </button>
        )}
      </div>


      {/* Footer */}
      <div className="px-4 py-8">
        <p className="text-center text-xs text-muted-foreground">
          p4no Developed by Smart Technology
        </p>
      </div>
    </div>
  );
};

export default MenuPage;
