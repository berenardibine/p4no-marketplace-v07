import { useState, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { GeoProvider } from "@/context/GeoContext";
import { CartProvider } from "@/context/CartContext";
import PreferenceThemeSync from "@/components/theme/PreferenceThemeSync";
import ScrollToTop from "@/components/layout/ScrollToTop";
import GoogleReviewPopup from "@/components/home/GoogleReviewPopup";
import ProfileCompletionGuard from "@/components/auth/ProfileCompletionGuard";

import SplashScreen from "@/components/pwa/SplashScreen";
import ReferralCapture from "@/components/referral/ReferralCapture";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import PermissionHandler from "@/components/pwa/PermissionHandler";
import PushNotificationInit from "@/components/pwa/PushNotificationInit";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ProductDetail from "./pages/ProductDetail";
import SellerDashboard from "./pages/SellerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AssetPage from "./pages/AssetPage";
import AgriculturePage from "./pages/AgriculturePage";
import RentPage from "./pages/RentPage";
import CategoryPage from "./pages/CategoryPage";
import NotificationsPage from "./pages/NotificationsPage";
import BlockedPage from "./pages/BlockedPage";
import SellerMonetization from "./pages/SellerMonetization";
import ShopPage from "./pages/ShopPage";
import ReferralLanding from "./pages/ReferralLanding";
import NotFound from "./pages/NotFound";
import AuthCallback from "./pages/AuthCallback";
import CompleteProfilePhone from "./pages/CompleteProfilePhone";
import CompleteProfile from "./pages/CompleteProfile";
import ReelsPage from "./pages/ReelsPage";
import ReelDetail from "./pages/ReelDetail";
import SearchPage from "./pages/SearchPage";
import InsightsHome from "./pages/insights/InsightsHome";
import InsightCategory from "./pages/insights/InsightCategory";
import InsightArticle from "./pages/insights/InsightArticle";
import InsightSearch from "./pages/insights/InsightSearch";
import AdminInsights from "./pages/admin/AdminInsights";
import AdminInsightEdit from "./pages/admin/AdminInsightEdit";
import AdminInsightCategories from "./pages/admin/AdminInsightCategories";
import AdminInsightAnalytics from "./pages/admin/AdminInsightAnalytics";
import AdminInsightComments from "./pages/admin/AdminInsightComments";
import AdminCommunityQA from "./pages/admin/AdminCommunityQA";
import AdminSellerBadges from "./pages/admin/AdminSellerBadges";
import ReferralDashboard from "./pages/ReferralDashboard";
import LeaderboardPage from "./pages/LeaderboardPage";
import WalletPage from "./pages/WalletPage";
import AdminRewardClaims from "./pages/admin/AdminRewardClaims";
import AdminWithdrawals from "./pages/admin/AdminWithdrawals";
import AdminRewardSettings from "./pages/admin/AdminRewardSettings";

// Menu Pages
import AccountPage from "./pages/AccountPage";
import MyShopPage from "./pages/MyShopPage";
import FavoritesPage from "./pages/FavoritesPage";
import ChallengesPage from "./pages/ChallengesPage";
import RewardsPage from "./pages/RewardsPage";
import PremiumPage from "./pages/PremiumPage";
import SettingsPage from "./pages/SettingsPage";
import HelpPage from "./pages/HelpPage";
import SupportPage from "./pages/SupportPage";

// Admin Pages
import { 
  AdminProducts, 
  AdminProductAdd, 
  AdminProductEdit,
  AdminUsers,
  AdminAnalytics,
  AdminShops,
  AdminCategories,
  AdminLocations,
  AdminMotivations,
  AdminNotifications,
  AdminMessages,
  AdminAds,
  AdminLinkAnalytics,
  AdminFilterAnalytics,
  AdminChallenges,
  AdminFileOptimization,
  AdminViewsAnalytics,
} from "./pages/admin";
import AdminReferrals from "./pages/admin/AdminReferrals";
import AdminComments from "./pages/admin/AdminComments";
import AdminReports from "./pages/admin/AdminReports";
import AdminSeoPages from "./pages/admin/AdminSeoPages";
import AdminVerifications from "./pages/admin/AdminVerifications";
import AdminCacheMonitor from "./pages/admin/AdminCacheMonitor";
import AdminStaticArchitecture from "./pages/admin/AdminStaticArchitecture";
import AdminProductStatic from "./pages/admin/AdminProductStatic";
import AdminPerformanceCenter from "./pages/admin/AdminPerformanceCenter";

import AdminEmailCenter from "./pages/admin/AdminEmailCenter";
import AdminBoosts from "./pages/admin/AdminBoosts";
import AdminReviews from "./pages/admin/AdminReviews";
import AdminDiscounts from "./pages/admin/AdminDiscounts";
import AdminSystemUsage from "./pages/admin/AdminSystemUsage";
import AdminFeatureToggles from "./pages/admin/AdminFeatureToggles";
import AdminTasks from "./pages/admin/AdminTasks";
import AdminPushDebug from "./pages/admin/AdminPushDebug";
import NotificationSettingsPage from "./pages/NotificationSettingsPage";
import VerifyIdentity from "./pages/VerifyIdentity";
import MenuPage from "./pages/MenuPage";
import SitePage from "./pages/SitePage";
import DynamicSlugPage from "./pages/DynamicSlugPage";
import CheckoutPage from "./pages/CheckoutPage";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminServices from "./pages/admin/AdminServices";
import FloatingCartBar from "./components/cart/FloatingCartBar";
import ErrorBoundary from "./components/error/ErrorBoundary";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import ConnectHome from "./pages/connect/ConnectHome";
import ConnectCategory from "./pages/connect/ConnectCategory";
import ConnectReels from "./pages/connect/ConnectReels";
import ServiceDetail from "./pages/connect/ServiceDetail";
import ProviderProfile from "./pages/connect/ProviderProfile";
import OnboardingAccountType from "./pages/OnboardingAccountType";
import SavedPage from "./pages/SavedPage";
import FollowingPage from "./pages/FollowingPage";
import BrowsingHistoryPage from "./pages/BrowsingHistoryPage";
import PageTransitionSplash from "./components/layout/PageTransitionSplash";
import { LoadingProvider } from "./context/LoadingContext";
import { installApiFirewall } from "@/lib/apiFirewall";
import { loadFeatureFlags } from "@/lib/featureFlags";
import FeatureGate, { FeatureRoute } from "@/components/system/FeatureGate";

// Install the network-level firewall before any Supabase request fires.
installApiFirewall();
// One tiny read per session; guards answer synchronously from localStorage meanwhile.
loadFeatureFlags();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // V1 Performance Engine defaults: everything static-first, event-driven.
      // Queries only re-run after an explicit invalidateQueries().
      staleTime: Infinity,
      gcTime: 24 * 60 * 60 * 1000, // 24h
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: false,
    },
    mutations: { retry: false },
  },
});

const App = () => {
  const [splashDone, setSplashDone] = useState(
    !!sessionStorage.getItem('sm-splash-shown')
  );

  const handleSplashComplete = useCallback(() => {
    setSplashDone(true);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <GeoProvider>
            <CartProvider>
            <LoadingProvider>
            {/* Initial PWA splash */}
            {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}

            <PreferenceThemeSync />
            <PermissionHandler />
            <PushNotificationInit />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollToTop />
              <PageTransitionSplash />
              <ReferralCapture />
              <ProfileCompletionGuard />
              
              <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/reels" element={<FeatureRoute feature="reels_module"><ReelsPage /></FeatureRoute>} />
                <Route path="/reels/:slugOrId" element={<FeatureRoute feature="reels_module"><ReelDetail /></FeatureRoute>} />
                <Route path="/reel/:slugOrId" element={<FeatureRoute feature="reels_module"><ReelDetail /></FeatureRoute>} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/search/:q" element={<SearchPage />} />
                <Route path="/search/:q/page/:page" element={<SearchPage />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/onboarding/account-type" element={<OnboardingAccountType />} />
                <Route path="/saved" element={<SavedPage />} />
                <Route path="/following" element={<FollowingPage />} />
                <Route path="/browsing-history" element={<FeatureRoute feature="recently_viewed"><ProtectedRoute><BrowsingHistoryPage /></ProtectedRoute></FeatureRoute>} />
                <Route path="/complete-profile/phone" element={<CompleteProfilePhone />} />
                <Route path="/complete-profile" element={<CompleteProfile />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/product/:slugOrId" element={<ProductDetail />} />
                <Route path="/products/:slugOrId" element={<ProductDetail />} />
                <Route path="/p/:slugOrId" element={<ProductDetail />} />
                <Route path="/products/:slugOrId/by/:shopSlug" element={<ProductDetail />} />
                <Route path="/seller-dashboard" element={<ProtectedRoute><SellerDashboard /></ProtectedRoute>} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/shop/:shopId" element={<ShopPage />} />
                <Route path="/r/:code" element={<ReferralLanding />} />
                <Route path="/referrals" element={<ProtectedRoute><ReferralDashboard /></ProtectedRoute>} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
                <Route path="/admin/reward-claims" element={<AdminRewardClaims />} />
                <Route path="/admin/withdrawals" element={<AdminWithdrawals />} />
                <Route path="/admin/reward-settings" element={<AdminRewardSettings />} />

                {/* P4NO Connect */}
                <Route path="/connect" element={<ConnectHome />} />
                <Route path="/connect/reels" element={<FeatureRoute feature="reels_module"><ConnectReels /></FeatureRoute>} />
                <Route path="/connect/category/:slug" element={<ConnectCategory />} />
                <Route path="/connect/service/:slugOrId" element={<ServiceDetail />} />
                <Route path="/connect/provider/:userId" element={<ProviderProfile />} />
                <Route path="/connect/provider/slug/:slug" element={<ProviderProfile />} />


                {/* Admin Routes */}
                <Route path="/admin/products" element={<AdminProducts />} />
                <Route path="/admin/products/add" element={<AdminProductAdd />} />
                <Route path="/admin/products/edit/:productId" element={<AdminProductEdit />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/admin/shops" element={<AdminShops />} />
                <Route path="/admin/categories" element={<AdminCategories />} />
                <Route path="/admin/locations" element={<AdminLocations />} />
                <Route path="/admin/motivations" element={<AdminMotivations />} />
                <Route path="/admin/notifications" element={<AdminNotifications />} />
                <Route path="/admin/push" element={<AdminPushDebug />} />
                <Route path="/admin/messages" element={<AdminMessages />} />
                <Route path="/admin/ads" element={<AdminAds />} />
                <Route path="/admin/link-analytics" element={<AdminLinkAnalytics />} />
                <Route path="/admin/filter-analytics" element={<AdminFilterAnalytics />} />
                <Route path="/admin/challenges" element={<AdminChallenges />} />
                <Route path="/admin/file-optimization" element={<AdminFileOptimization />} />
                <Route path="/admin/views-analytics" element={<AdminViewsAnalytics />} />
                <Route path="/admin/referrals" element={<AdminReferrals />} />
                <Route path="/admin/comments" element={<AdminComments />} />
                <Route path="/admin/reports" element={<AdminReports />} />
                <Route path="/admin/seo" element={<AdminSeoPages />} />
                <Route path="/admin/verifications" element={<AdminVerifications />} />
                <Route path="/admin/cache" element={<AdminCacheMonitor />} />
                <Route path="/admin/static-architecture" element={<AdminStaticArchitecture />} />
                <Route path="/admin/product-static" element={<AdminProductStatic />} />
                <Route path="/admin/performance" element={<AdminPerformanceCenter />} />

                <Route path="/admin/email-center" element={<AdminEmailCenter />} />
                <Route path="/admin/boosts" element={<AdminBoosts />} />
                <Route path="/admin/reviews" element={<AdminReviews />} />
                <Route path="/admin/discounts" element={<AdminDiscounts />} />
                <Route path="/admin/system-usage" element={<AdminSystemUsage />} />
                <Route path="/admin/feature-toggles" element={<AdminFeatureToggles />} />
                <Route path="/admin/tasks" element={<AdminTasks />} />
                <Route path="/admin/orders" element={<AdminOrders />} />
                <Route path="/admin/services" element={<AdminServices />} />
                <Route path="/admin/insights" element={<AdminInsights />} />
                <Route path="/admin/insights/new" element={<AdminInsightEdit />} />
                <Route path="/admin/insights/:id/edit" element={<AdminInsightEdit />} />
                <Route path="/admin/insights/categories" element={<AdminInsightCategories />} />
                <Route path="/admin/insights/analytics" element={<AdminInsightAnalytics />} />
                <Route path="/admin/insights/comments" element={<AdminInsightComments />} />
                <Route path="/admin/community-qa" element={<AdminCommunityQA />} />
                <Route path="/admin/seller-badges" element={<AdminSellerBadges />} />

                {/* P4NO Insights */}
                <Route path="/insights" element={<FeatureRoute feature="articles_module"><InsightsHome /></FeatureRoute>} />
                <Route path="/insights/category/:slug" element={<FeatureRoute feature="articles_module"><InsightCategory /></FeatureRoute>} />
                <Route path="/insights/category/:slug/page/:page" element={<FeatureRoute feature="articles_module"><InsightCategory /></FeatureRoute>} />
                <Route path="/insights/article/:slug" element={<FeatureRoute feature="articles_module"><InsightArticle /></FeatureRoute>} />
                <Route path="/insights/search/:q" element={<FeatureRoute feature="articles_module"><InsightSearch /></FeatureRoute>} />
                <Route path="/checkout" element={<FeatureRoute feature="mark_order_system"><ProtectedRoute allowGuest><CheckoutPage /></ProtectedRoute></FeatureRoute>} />
                <Route path="/verify-identity" element={<VerifyIdentity />} />

                <Route path="/menu" element={<MenuPage />} />
                <Route path="/page/:slug" element={<SitePage />} />

                <Route path="/assets" element={<AssetPage />} />
                <Route path="/agriculture" element={<AgriculturePage />} />
                <Route path="/rent" element={<RentPage />} />
                <Route path="/category/:slug" element={<CategoryPage />} />
                <Route path="/category/:slug/page/:page" element={<CategoryPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/settings/notifications" element={<ProtectedRoute><NotificationSettingsPage /></ProtectedRoute>} />
                <Route path="/blocked" element={<BlockedPage />} />
                <Route path="/seller-monetization" element={<SellerMonetization />} />

                {/* Menu Pages */}
                <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
                <Route path="/my-shop" element={<ProtectedRoute><MyShopPage /></ProtectedRoute>} />
                <Route path="/favorites" element={<FavoritesPage />} />
                <Route path="/challenges" element={<ChallengesPage />} />
                <Route path="/rewards" element={<RewardsPage />} />
                <Route path="/premium" element={<PremiumPage />} />
                <Route path="/settings" element={<ProtectedRoute allowGuest><SettingsPage /></ProtectedRoute>} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/support" element={<SupportPage />} />

                {/* Dynamic slug resolver: checks category → site page → 404 */}
                <Route path="/:slug" element={<DynamicSlugPage />} />

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </ErrorBoundary>
              <FeatureGate feature="mark_order_system"><FloatingCartBar /></FeatureGate>
              <GoogleReviewPopup />
              <InstallPrompt />
            </BrowserRouter>
            </LoadingProvider>
            </CartProvider>
          </GeoProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
