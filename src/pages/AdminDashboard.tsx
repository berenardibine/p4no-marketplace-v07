import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, Package, Store, 
  Bell, BarChart3, Quote, Megaphone,
  Shield, FolderTree, MapPin, Menu, X,
  Home, Eye, LogOut, ChevronRight, TrendingUp, Activity,
  MessageSquare, Plus, Settings, Sparkles, Crown, 
  Zap, Target, Layers, PieChart, Rocket, Globe,
  Calendar, Clock, CheckCircle2, AlertCircle, MessageCircle, Flag, Star, Tag,
  ShoppingCart, Briefcase, Newspaper, Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useTwoFactor } from "@/hooks/useTwoFactor";
import { useAdminNotifications } from "@/hooks/useAdminNotifications";
import TwoFactorVerifyModal from "@/components/settings/TwoFactorVerifyModal";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { signOut, profile, user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const twoFactor = useTwoFactor(user?.id);
  const { getModuleCount, totalUnread, recentNotifications, markModuleAsRead, markAllAsRead } = useAdminNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const [twoFAVerified, setTwoFAVerified] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    totalViews: 0,
    activeShops: 0,
    newUsersToday: 0,
    pendingProducts: 0,
    totalServices: 0,
    totalServiceViews: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [usersRes, productsRes, shopsRes, newUsersRes, pendingRes, viewsRes, impressionsRes, servicesRes, serviceViewsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('shops').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('product_views').select('id', { count: 'exact', head: true }),
        supabase.from('product_impressions').select('id', { count: 'exact', head: true }),
        supabase.from('services').select('id', { count: 'exact', head: true }),
        supabase.from('service_views').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalUsers: usersRes.count || 0,
        totalProducts: productsRes.count || 0,
        totalViews: viewsRes.count || 0,
        activeShops: shopsRes.count || 0,
        newUsersToday: newUsersRes.count || 0,
        pendingProducts: pendingRes.count || 0,
        totalServices: servicesRes.count || 0,
        totalServiceViews: serviceViewsRes.count || 0,
      });
    };

    if (isAdmin) {
      fetchStats();
    }
  }, [isAdmin]);

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mx-auto mb-4 animate-pulse shadow-lg">
            <Shield className="h-10 w-10 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-card rounded-3xl p-8 border shadow-xl">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-destructive/20 to-destructive/10 flex items-center justify-center mx-auto mb-6">
            <Shield className="h-12 w-12 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have permission to access this page.
          </p>
          <Button onClick={() => navigate('/')} className="gap-2 rounded-xl">
            <Home className="h-4 w-4" />
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  // 2FA gate for admin dashboard
  const needs2FA = twoFactor.enabled && !twoFactor.verified && !twoFAVerified;
  if (needs2FA && !twoFactor.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <TwoFactorVerifyModal
          open={true}
          onClose={() => navigate('/')}
          onVerified={() => {
            setTwoFAVerified(true);
            twoFactor.refresh();
          }}
          userId={user!.id}
          title="Admin Dashboard Access"
          description="Enter your 2FA code to access the admin dashboard."
        />
      </div>
    );
  }

  const modules = [
    { id: 'products', label: 'Products', icon: Package, color: 'from-orange-500 to-amber-500', bg: 'bg-orange-50 dark:bg-orange-950/30', path: '/admin/products', description: 'Manage listings' },
    { id: 'users', label: 'Users', icon: Users, color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50 dark:bg-blue-950/30', path: '/admin/users', description: 'User accounts' },
    { id: 'shops', label: 'Shops', icon: Store, color: 'from-purple-500 to-violet-500', bg: 'bg-purple-50 dark:bg-purple-950/30', path: '/admin/shops', description: 'Seller stores' },
    { id: 'categories', label: 'Categories', icon: FolderTree, color: 'from-indigo-500 to-blue-500', bg: 'bg-indigo-50 dark:bg-indigo-950/30', path: '/admin/categories', description: 'Product types' },
    { id: 'locations', label: 'Locations', icon: Globe, color: 'from-rose-500 to-pink-500', bg: 'bg-rose-50 dark:bg-rose-950/30', path: '/admin/locations', description: 'Geographic areas' },
    
    { id: 'file-optimization', label: 'Optimizer', icon: Sparkles, color: 'from-violet-500 to-purple-500', bg: 'bg-violet-50 dark:bg-violet-950/30', path: '/admin/file-optimization', description: 'AI file optimize' },
    { id: 'analytics', label: 'Analytics', icon: PieChart, color: 'from-cyan-500 to-teal-500', bg: 'bg-cyan-50 dark:bg-cyan-950/30', path: '/admin/analytics', description: 'Platform stats' },
    { id: 'views-analytics', label: 'Views', icon: Eye, color: 'from-sky-500 to-blue-500', bg: 'bg-sky-50 dark:bg-sky-950/30', path: '/admin/views-analytics', description: 'Impressions & views' },
    { id: 'link-analytics', label: 'Links', icon: TrendingUp, color: 'from-teal-500 to-emerald-500', bg: 'bg-teal-50 dark:bg-teal-950/30', path: '/admin/link-analytics', description: 'Traffic tracking' },
    { id: 'notifications', label: 'Notify', icon: Bell, color: 'from-yellow-500 to-orange-500', bg: 'bg-yellow-50 dark:bg-yellow-950/30', path: '/admin/notifications', description: 'Push alerts' },
    { id: 'messages', label: 'Messages', icon: MessageSquare, color: 'from-green-500 to-emerald-500', bg: 'bg-green-50 dark:bg-green-950/30', path: '/admin/messages', description: 'User inbox' },
    { id: 'ads', label: 'Ads', icon: Megaphone, color: 'from-red-500 to-rose-500', bg: 'bg-red-50 dark:bg-red-950/30', path: '/admin/ads', description: 'Smart ads' },
    { id: 'referrals', label: 'Referrals', icon: Users, color: 'from-amber-500 to-yellow-500', bg: 'bg-amber-50 dark:bg-amber-950/30', path: '/admin/referrals', description: 'Referral system' },
    { id: 'comments', label: 'Comments', icon: MessageCircle, color: 'from-lime-500 to-green-500', bg: 'bg-lime-50 dark:bg-lime-950/30', path: '/admin/comments', description: 'Moderation' },
    { id: 'reports', label: 'Reports', icon: Flag, color: 'from-red-600 to-rose-600', bg: 'bg-red-50 dark:bg-red-950/30', path: '/admin/reports', description: 'User reports' },
    { id: 'seo', label: 'SEO Pages', icon: Globe, color: 'from-emerald-500 to-green-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', path: '/admin/seo', description: 'Legal & SEO' },
    { id: 'verifications', label: 'Verifications', icon: Shield, color: 'from-emerald-600 to-teal-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', path: '/admin/verifications', description: 'ID verification' },
    { id: 'email-center', label: 'Email', icon: MessageSquare, color: 'from-orange-600 to-red-500', bg: 'bg-orange-50 dark:bg-orange-950/30', path: '/admin/email-center', description: 'Send emails' },
    { id: 'boosts', label: 'Boosts', icon: Rocket, color: 'from-pink-500 to-rose-500', bg: 'bg-pink-50 dark:bg-pink-950/30', path: '/admin/boosts', description: 'Product boosts' },
    { id: 'reviews', label: 'Reviews', icon: Star, color: 'from-amber-500 to-yellow-500', bg: 'bg-amber-50 dark:bg-amber-950/30', path: '/admin/reviews', description: 'Seller ratings' },
    { id: 'discounts', label: 'Discounts', icon: Tag, color: 'from-red-500 to-pink-500', bg: 'bg-red-50 dark:bg-red-950/30', path: '/admin/discounts', description: 'Smart discounts' },
    { id: 'system-usage', label: 'System', icon: Activity, color: 'from-slate-500 to-zinc-500', bg: 'bg-slate-50 dark:bg-slate-950/30', path: '/admin/system-usage', description: 'Usage & health' },
    { id: 'feature-toggles', label: 'Features', icon: Activity, color: 'from-cyan-500 to-blue-500', bg: 'bg-cyan-50 dark:bg-cyan-950/30', path: '/admin/feature-toggles', description: 'Enable / shut down modules' },
    { id: 'tasks', label: 'Tasks', icon: Target, color: 'from-blue-500 to-indigo-500', bg: 'bg-blue-50 dark:bg-blue-950/30', path: '/admin/tasks', description: 'Tasks & rewards' },
    { id: 'orders', label: 'Orders', icon: ShoppingCart, color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', path: '/admin/orders', description: 'All orders' },
    { id: 'services', label: 'Services', icon: Briefcase, color: 'from-pink-500 to-rose-500', bg: 'bg-pink-50 dark:bg-pink-950/30', path: '/admin/services', description: 'P4NO Connect moderation' },
    { id: 'insights', label: 'Insights', icon: Newspaper, color: 'from-amber-600 to-orange-600', bg: 'bg-amber-50 dark:bg-amber-950/30', path: '/admin/insights', description: 'P4NO Insights articles' },
    { id: 'community-qa', label: 'Community Q&A', icon: MessageCircle, color: 'from-fuchsia-500 to-pink-500', bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/30', path: '/admin/community-qa', description: 'Moderate product Q&A' },
    { id: 'seller-badges', label: 'Seller Badges', icon: MessageCircle, color: 'from-amber-500 to-orange-500', bg: 'bg-amber-50 dark:bg-amber-950/30', path: '/admin/seller-badges', description: 'View earned badges & progress' },
    { id: 'push-debug', label: 'Push Debug', icon: Bell, color: 'from-fuchsia-500 to-purple-500', bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/30', path: '/admin/push', description: 'FCM tokens & test push' },
    { id: 'cache', label: 'Cache Monitor', icon: Database, color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', path: '/admin/cache', description: 'Redis cache & egress stats' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 pb-24">
      {/* Premium Header */}
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <Crown className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-base flex items-center gap-1">
                Admin Panel
                <Sparkles className="h-4 w-4 text-primary" />
              </h1>
              <p className="text-xs text-muted-foreground">p4no HQ</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/notifications')} className="rounded-xl relative">
              <Bell className="h-5 w-5" />
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-destructive rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-xl">
              <Home className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setMenuOpen(true)} className="rounded-xl">
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setMenuOpen(false)} />
      )}

      {/* Side Menu */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-80 bg-card border-l z-50 transition-transform duration-300 shadow-2xl",
        menuOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <h2 className="font-bold">Admin Menu</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMenuOpen(false)} className="rounded-xl">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-4">
          {/* Profile Card */}
          <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl mb-4 border border-primary/20">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg">
              {profile?.full_name?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{profile?.full_name || 'Admin'}</p>
              <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
              <span className="inline-flex items-center gap-1 text-xs text-primary font-medium mt-1">
                <Crown className="h-3 w-3" /> Super Admin
              </span>
            </div>
          </div>

          {/* Menu Items */}
          <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto">
            {modules.map((module) => {
              const badgeCount = getModuleCount(module.id);
              return (
                <button
                  key={module.id}
                  onClick={() => {
                    setMenuOpen(false);
                    if (badgeCount > 0) markModuleAsRead(module.id);
                    navigate(module.path);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-all text-left group relative"
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br relative",
                    module.color
                  )}>
                    <module.icon className="h-5 w-5 text-white" />
                    {badgeCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full text-[10px] text-white flex items-center justify-center font-bold shadow-sm">
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm block">{module.label}</span>
                    <span className="text-xs text-muted-foreground">{module.description}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t">
            <Button 
              variant="outline" 
              className="w-full gap-2 text-destructive hover:bg-destructive/10 rounded-xl border-destructive/30"
              onClick={() => { signOut(); navigate('/'); }}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-6">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-primary via-primary/90 to-primary/80 rounded-3xl p-6 text-primary-foreground shadow-xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Rocket className="h-5 w-5" />
              <span className="text-sm font-medium opacity-90">Welcome back!</span>
            </div>
            <h2 className="text-2xl font-bold mb-1">{profile?.full_name || 'Admin'}</h2>
            <p className="text-sm opacity-80">Your p4no control center is ready</p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div 
            className="bg-card rounded-2xl p-4 border shadow-sm hover:shadow-md transition-all cursor-pointer group"
            onClick={() => navigate('/admin/users')}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              {stats.newUsersToday > 0 && (
                <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  +{stats.newUsersToday}
                </span>
              )}
            </div>
            <p className="text-3xl font-bold">{stats.totalUsers.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </div>

          <div 
            className="bg-card rounded-2xl p-4 border shadow-sm hover:shadow-md transition-all cursor-pointer"
            onClick={() => navigate('/admin/products')}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
                <Package className="h-6 w-6 text-white" />
              </div>
              {stats.pendingProducts > 0 && (
                <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {stats.pendingProducts}
                </span>
              )}
            </div>
            <p className="text-3xl font-bold">{stats.totalProducts.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Products</p>
          </div>

          <div 
            className="bg-card rounded-2xl p-4 border shadow-sm hover:shadow-md transition-all cursor-pointer"
            onClick={() => navigate('/admin/analytics')}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-3 shadow-lg">
              <Eye className="h-6 w-6 text-white" />
            </div>
            <p className="text-3xl font-bold">{stats.totalViews.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total Views</p>
          </div>

          <div 
            className="bg-card rounded-2xl p-4 border shadow-sm hover:shadow-md transition-all cursor-pointer"
            onClick={() => navigate('/admin/shops')}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center mb-3 shadow-lg">
              <Store className="h-6 w-6 text-white" />
            </div>
            <p className="text-3xl font-bold">{stats.activeShops.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Active Shops</p>
          </div>

          <div
            className="bg-card rounded-2xl p-4 border shadow-sm hover:shadow-md transition-all cursor-pointer"
            onClick={() => navigate('/admin/services')}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center mb-3 shadow-lg">
              <Briefcase className="h-6 w-6 text-white" />
            </div>
            <p className="text-3xl font-bold">{stats.totalServices.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Services</p>
          </div>

          <div
            className="bg-card rounded-2xl p-4 border shadow-sm hover:shadow-md transition-all cursor-pointer"
            onClick={() => navigate('/admin/views-analytics')}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center mb-3 shadow-lg">
              <Eye className="h-6 w-6 text-white" />
            </div>
            <p className="text-3xl font-bold">{stats.totalServiceViews.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Service Views</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="font-bold">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2 rounded-2xl border-2 hover:border-primary hover:bg-primary/5 transition-all"
              onClick={() => navigate('/admin/products/add')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                <Plus className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xs font-medium">Add</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2 rounded-2xl border-2 hover:border-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-950/30 transition-all"
              onClick={() => navigate('/admin/notifications')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <span className="text-xs font-medium">Notify</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2 rounded-2xl border-2 hover:border-pink-500 hover:bg-pink-50 dark:hover:bg-pink-950/30 transition-all"
              onClick={() => navigate('/admin/ads')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                <Megaphone className="h-5 w-5 text-white" />
              </div>
              <span className="text-xs font-medium">Ads</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2 rounded-2xl border-2 hover:border-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 transition-all"
              onClick={() => navigate('/admin/analytics')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <span className="text-xs font-medium">Stats</span>
            </Button>
          </div>
        </div>

        {/* Recent Activity */}
        {recentNotifications.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h2 className="font-bold">Recent Activity</h2>
              </div>
              {totalUnread > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="bg-card rounded-2xl border divide-y divide-border overflow-hidden">
              {recentNotifications.slice(0, 5).map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    "flex items-start gap-3 p-3 cursor-pointer hover:bg-accent/50 transition-colors",
                    !notif.is_read && "bg-primary/5"
                  )}
                  onClick={() => {
                    if (notif.module) {
                      markModuleAsRead(notif.module);
                      const mod = modules.find(m => m.id === notif.module);
                      if (mod) navigate(mod.path);
                    }
                  }}
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full mt-2 shrink-0",
                    notif.is_read ? "bg-muted-foreground/30" : "bg-destructive"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{notif.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {new Date(notif.created_at).toLocaleDateString()} · {notif.module}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Modules */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="font-bold">All Modules</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {modules.map((module) => {
              const badgeCount = getModuleCount(module.id);
              return (
                <button
                  key={module.id}
                  onClick={() => {
                    if (badgeCount > 0) markModuleAsRead(module.id);
                    navigate(module.path);
                  }}
                  className={cn(
                    "p-4 rounded-2xl border-2 hover:shadow-lg transition-all text-left group relative",
                    module.bg,
                    "border-transparent hover:border-current/20"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br shadow-md group-hover:scale-110 transition-transform relative",
                    module.color
                  )}>
                    <module.icon className="h-6 w-6 text-white" />
                    {badgeCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-destructive rounded-full text-[10px] text-white flex items-center justify-center font-bold shadow-sm">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-sm mb-0.5">{module.label}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{module.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10">
            <Crown className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">p4no Admin v2.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;