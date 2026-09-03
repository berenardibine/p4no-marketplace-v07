import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  ArrowLeft, Store, Package, Plus, MessageSquare, Bell,
  Settings, ChevronRight, Phone,
  Menu, X, Home,
  Zap, Briefcase, Inbox,
  Sparkles, Rocket, Shield, AlertTriangle, Share2,
  ShoppingCart, BarChart3, Eye, MousePointerClick
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useMyShop } from "@/hooks/useShops";
import { useMyProducts } from "@/hooks/useProducts";
import { useProductRequests } from "@/hooks/useProductRequests";
import { useToast } from "@/hooks/use-toast";
import { useIdentityVerification } from "@/hooks/useIdentityVerification";
import { useAdminSettings } from "@/hooks/useAdminSettings";
import ShopForm from "@/components/seller/ShopForm";
import ProductForm from "@/components/seller/ProductForm";
import HomeAds from "@/components/home/HomeAds";
import ProductList from "@/components/seller/ProductList";
import SellerAchievementsCard from "@/components/badges/SellerAchievementsCard";
import RequestList from "@/components/seller/RequestList";
import SellerOrdersTab from "@/components/seller/SellerOrdersTab";
import SellerServicesTab from "@/components/seller/SellerServicesTab";
import { useServiceRequests } from "@/hooks/useServiceRequests";
import TwoFactorVerifyModal from "@/components/settings/TwoFactorVerifyModal";
import SellerProductAnalytics from "@/components/seller/SellerProductAnalytics";
import { useTwoFactor } from "@/hooks/useTwoFactor";
import { useWeeklyStats } from "@/hooks/useWeeklyStats";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/formatNumber";

const SellerDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { shop, loading: shopLoading, createShop, updateShop } = useMyShop();
  const { products, loading: productsLoading, refetch: refetchProducts } = useMyProducts();
  const { requests, loading: requestsLoading, updateRequestStatus } = useProductRequests();
  const twoFactor = useTwoFactor(user?.id);
  const { verification: idVerification, loading: idLoading } = useIdentityVerification(user?.id);
  const { getSetting, loading: settingsLoading } = useAdminSettings();
  const { stats: weeklyStats } = useWeeklyStats();
  const { pendingCount: pendingServiceReq } = useServiceRequests();
  
  const [activeModule, setActiveModule] = useState<string | null>(null);

  // Pre-open module via ?module=services (e.g. from P4NO Connect CTA)
  useEffect(() => {
    const m = searchParams.get('module');
    if (m) setActiveModule(m);
  }, [searchParams]);
  const [showShopForm, setShowShopForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [show2FAGate, setShow2FAGate] = useState(false);
  const [twoFAVerified, setTwoFAVerified] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  // Total followers across shop + provider profile
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const provRes = await supabase.from('follows').select('id', { count: 'exact', head: true })
        .eq('target_type', 'provider').eq('target_id', user.id);
      let shopCount = 0;
      if (shop?.id) {
        const shopRes = await supabase.from('follows').select('id', { count: 'exact', head: true })
          .eq('target_type', 'shop').eq('target_id', shop.id);
        shopCount = shopRes.count || 0;
      }
      if (cancelled) return;
      setFollowerCount((provRes.count || 0) + shopCount);
    })();
    return () => { cancelled = true; };
  }, [user?.id, shop?.id]);


  const pendingRequests = requests.filter(r => r.status === 'pending');
  const requireVerification = getSetting('require_identity_verification', false);
  const isVerified = (profile as any)?.identity_verified === true;

  const handleCreateShop = async (data: any) => {
    try {
      await createShop(data);
      toast({ title: "Shop created successfully! 🎉" });
      setShowShopForm(false);
    } catch (err: any) {
      toast({ title: "Failed to create shop", description: err.message, variant: "destructive" });
    }
  };

  const handleUpdateShop = async (data: any) => {
    try {
      await updateShop(data);
      toast({ title: "Shop updated successfully!" });
      setShowShopForm(false);
    } catch (err: any) {
      toast({ title: "Failed to update shop", description: err.message, variant: "destructive" });
    }
  };

  const handleProductSuccess = () => {
    setShowProductForm(false);
    setEditingProduct(null);
    refetchProducts();
    toast({ title: editingProduct ? "Product updated!" : "Product created! 🎉" });
  };

  // 2FA gate
  const needs2FA = twoFactor.enabled && !twoFactor.verified && !twoFAVerified;

  // Can post: either verification not required, or user is verified
  const canPost = !requireVerification || isVerified;

  // Show loading while auth is resolving
  const { loading: authLoading } = useAuth();
  if (authLoading || !user || shopLoading || settingsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mx-auto mb-4 animate-pulse shadow-lg">
            <Store className="h-10 w-10 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!profile || profile.user_type !== 'seller') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center p-8 bg-card rounded-3xl shadow-xl max-w-md mx-4 border">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Store className="h-10 w-10 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Seller Access Only</h2>
          <p className="text-muted-foreground mb-6">You need a seller account to access this dashboard.</p>
          <Button onClick={() => navigate('/')} className="gap-2 rounded-xl px-6">
            <Home className="h-4 w-4" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

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
          title="Seller Dashboard Access"
          description="Enter your 2FA code to access the seller dashboard."
        />
      </div>
    );
  }

  if (showShopForm) {
    return (
      <ShopForm 
        shop={shop} 
        onSubmit={shop ? handleUpdateShop : handleCreateShop}
        onCancel={() => setShowShopForm(false)}
      />
    );
  }

  if (showProductForm || editingProduct) {
    return (
      <ProductForm 
        product={editingProduct}
        shopId={shop?.id}
        onSuccess={handleProductSuccess}
        onCancel={() => {
          setShowProductForm(false);
          setEditingProduct(null);
        }}
      />
    );
  }

  const modules = [
    { id: 'products', label: 'Products', icon: Package, color: 'from-orange-500 to-amber-500', bg: 'bg-orange-50 dark:bg-orange-950/30', description: 'Manage listings' },
    { id: 'shop', label: 'My Shop', icon: Store, color: 'from-purple-500 to-violet-500', bg: 'bg-purple-50 dark:bg-purple-950/30', description: 'Shop settings' },
    { id: 'achievements', label: 'Achievements', icon: Sparkles, color: 'from-amber-400 to-orange-500', bg: 'bg-amber-50 dark:bg-amber-950/30', description: 'Badges & progress' },
    { id: 'orders', label: 'Orders & Requests', icon: ShoppingCart, color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', description: 'Customer orders & requests' },
    { id: 'services', label: 'P4NO Connect', icon: Briefcase, color: 'from-pink-500 to-rose-500', bg: 'bg-pink-50 dark:bg-pink-950/30', description: 'My services' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, color: 'from-indigo-500 to-blue-500', bg: 'bg-indigo-50 dark:bg-indigo-950/30', description: 'View performance' },
  ];

  const renderModule = () => {
    switch (activeModule) {
      case 'products':
        return (
          <div className="space-y-4">
            {requireVerification && !isVerified && (
              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Verification required to post products</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Please verify your identity first to start selling.</p>
                </div>
              </div>
            )}
            {shop && !(shop as any).cover_image_url && (
              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Cover image required</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Add a shop cover image before uploading products.</p>
                  <button onClick={() => setShowShopForm(true)} className="text-xs font-semibold text-primary mt-1 underline">Edit shop now</button>
                </div>
              </div>
            )}
            <Button 
              onClick={() => {
                if (!shop) { toast({ title: "Create a shop first" }); return; }
                if (!(shop as any).cover_image_url) { toast({ title: "Add a shop cover image first", description: "Edit your shop and upload a cover image to start adding products.", variant: "destructive" }); return; }
                if (requireVerification && !isVerified) { toast({ title: "Verify your identity first", description: "Go to the dashboard to start verification.", variant: "destructive" }); return; }
                setShowProductForm(true);
              }}
              className="w-full gap-2 rounded-xl h-12 bg-gradient-to-r from-primary to-primary/80"
              disabled={!shop || !(shop as any).cover_image_url || (requireVerification && !isVerified)}
            >
              <Plus className="h-4 w-4" /> Add New Product
            </Button>
            <ProductList 
              products={products} 
              loading={productsLoading}
              onEdit={(product) => setEditingProduct(product)}
              onRefresh={refetchProducts}
            />
          </div>
        );
      case 'shop':
        return shop ? (
          <div className="space-y-4">
            <div className="bg-card rounded-3xl overflow-hidden border shadow-sm">
              <div className="h-28 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />
              <div className="p-4 -mt-14">
                <div className="w-24 h-24 rounded-2xl bg-card border-4 border-card flex items-center justify-center overflow-hidden shadow-lg">
                  {shop.logo_url ? (
                    <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover" />
                  ) : (
                    <Store className="h-12 w-12 text-primary" />
                  )}
                </div>
                <h2 className="text-xl font-bold mt-3">{shop.name}</h2>
                {shop.description && <p className="text-muted-foreground text-sm mt-1">{shop.description}</p>}
              </div>
            </div>
            <div className="bg-card rounded-2xl p-4 border space-y-3">
              <h3 className="font-semibold">Contact Information</h3>
              {shop.contact_phone && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium">{shop.contact_phone}</span>
                </div>
              )}
              {shop.whatsapp && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-green-600" />
                  </div>
                  <span className="text-sm font-medium">{shop.whatsapp}</span>
                </div>
              )}
            </div>
            <Button onClick={() => setShowShopForm(true)} className="w-full gap-2 rounded-xl h-12">
              <Settings className="h-4 w-4" /> Edit Shop Details
            </Button>
          </div>
        ) : (
          <div className="text-center py-12 bg-card rounded-2xl border">
            <Store className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No Shop Yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Create your shop to start selling</p>
            <Button onClick={() => setShowShopForm(true)} className="gap-2 rounded-xl">
              <Plus className="h-4 w-4" /> Create Shop
            </Button>
          </div>
        );
      case 'orders':
        return (
          <div className="space-y-6">
            <h3 className="font-semibold text-lg">Orders</h3>
            <SellerOrdersTab />
            <div className="border-t pt-6">
              <h3 className="font-semibold text-lg mb-4">Product Requests</h3>
              <RequestList 
                requests={requests}
                loading={requestsLoading}
                onUpdateStatus={updateRequestStatus}
              />
            </div>
          </div>
        );
      case 'analytics':
        return <SellerProductAnalytics />;
      case 'services':
        return <SellerServicesTab />;
      case 'achievements':
        return user ? <SellerAchievementsCard userId={user.id} /> : null;
      default:
        return null;
    }
  };

  if (activeModule) {
    const mod = modules.find(m => m.id === activeModule);
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 pb-24">
        <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b">
          <div className="flex items-center justify-between h-14 px-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveModule(null)} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h1 className="font-bold text-lg">{mod?.label}</h1>
            </div>
            <button onClick={() => navigate('/')} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
              <Home className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="p-4">{renderModule()}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-base flex items-center gap-1">
                Seller Dashboard
                <Sparkles className="h-4 w-4 text-primary" />
              </h1>
              <p className="text-xs text-muted-foreground">{profile.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/notifications')} className="rounded-xl relative">
              <Bell className="h-5 w-5" />
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full text-xs text-destructive-foreground flex items-center justify-center font-medium">
                  {pendingRequests.length}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-xl">
              <Home className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

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
            <h2 className="text-2xl font-bold mb-1">{profile.full_name}</h2>
            <p className="text-sm opacity-80">{shop ? shop.name : 'Set up your shop to start selling'}</p>
          </div>
        </div>

        {/* Identity Verification Warning - only show when verification is required */}
        {requireVerification && !idLoading && !isVerified && (
          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-2xl p-4 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Verify Your Identity</h3>
                <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                  {idVerification?.status === 'pending_review'
                    ? 'Your verification is under review. You\'ll be notified once approved.'
                    : idVerification?.status === 'rejected'
                    ? `Verification rejected: ${idVerification.admin_notes || 'Please retry.'}`
                    : 'To sell safely on p4no, please verify your identity first.'}
                </p>
                {(!idVerification || idVerification.status === 'rejected' || idVerification.status === 'retry_required') && (
                  <Button onClick={() => navigate('/verify-identity')} size="sm" className="gap-2 rounded-xl bg-amber-600 hover:bg-amber-700">
                    <Shield className="h-4 w-4" /> Verify Now
                  </Button>
                )}
                {idVerification?.status === 'pending_review' && (
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">Under Review</Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Verified Badge */}
        {isVerified && (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-800">
            <Shield className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">✔ Verified Seller</span>
          </div>
        )}

        {/* Create Shop CTA */}
        {!shop && !shopLoading && (
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-5 border border-primary/20">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shrink-0">
                <Store className="h-7 w-7 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-1">Create Your Shop</h3>
                <p className="text-muted-foreground text-sm mb-4">Set up your shop to start selling products.</p>
                <Button onClick={() => setShowShopForm(true)} className="gap-2 rounded-xl">
                  <Plus className="h-4 w-4" /> Create Shop
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Followers */}
        <div className="flex justify-end">
          <button
            onClick={() => navigate('/account')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-accent transition-colors text-xs font-semibold"
            aria-label="View followers"
          >
            <span>{formatNumber(followerCount)}</span>
            <span className="text-muted-foreground">Followers</span>
          </button>
        </div>

        {/* Weekly Analytics Overview */}
        {weeklyStats && (weeklyStats.weeklyViews > 0 || weeklyStats.weeklyImpressions > 0) && (
          <div 
            className="bg-card rounded-2xl p-4 border shadow-sm cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => setActiveModule('analytics')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">This Week</h3>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-lg font-bold">{formatNumber(weeklyStats.weeklyViews)}</p>
                  <p className="text-xs text-muted-foreground">Views</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-lg font-bold">{formatNumber(weeklyStats.weeklyImpressions)}</p>
                  <p className="text-xs text-muted-foreground">Impressions</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl p-4 border shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
                <Package className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold">{products.length}</p>
            <p className="text-sm text-muted-foreground">Products</p>
          </div>
          <div className="bg-card rounded-2xl p-4 border shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center shadow-lg">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
              {pendingRequests.length > 0 && (
                <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-full font-medium">
                  {pendingRequests.length} new
                </span>
              )}
            </div>
            <p className="text-3xl font-bold">{requests.length}</p>
            <p className="text-sm text-muted-foreground">Requests</p>
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
              onClick={() => shop ? setShowProductForm(true) : toast({ title: "Create a shop first" })}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                <Plus className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xs font-medium">Add</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2 rounded-2xl border-2 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/30 transition-all relative"
              onClick={() => setActiveModule('requests')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <span className="text-xs font-medium">Inbox</span>
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full text-[10px] text-destructive-foreground flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* All Modules Grid */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="font-bold">All Modules</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {modules.map((module) => (
              <button
                key={module.id}
                onClick={() => setActiveModule(module.id)}
                className={cn(
                  "p-4 rounded-2xl border-2 hover:shadow-lg transition-all text-left group",
                  module.bg,
                  "border-transparent hover:border-current/20"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br shadow-md group-hover:scale-110 transition-transform",
                  module.color
                )}>
                  <module.icon className="h-6 w-6 text-white" />
                </div>
                <p className="font-semibold text-sm mb-0.5">{module.label}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{module.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Products */}
        {products.length > 0 && (
          <div className="bg-card rounded-2xl p-4 border shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Recent Products
              </h3>
              <button 
                onClick={() => setActiveModule('products')}
                className="text-sm text-primary hover:underline font-medium"
              >
                View All
              </button>
            </div>
            <div className="space-y-2">
              {products.slice(0, 3).map(product => (
                <div key={product.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                  <img 
                    src={product.images?.[0] || '/placeholder.svg'} 
                    alt={product.title}
                    className="w-14 h-14 rounded-xl object-cover shadow-sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product.title}</p>
                    <p className="text-xs text-primary font-bold">
                      {(product as any).currency_symbol || '$'}{product.price?.toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    Qty: {product.quantity}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seller Ads from Admin */}
        <HomeAds />

        {/* Footer */}
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">p4no Seller</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerDashboard;
