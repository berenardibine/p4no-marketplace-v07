import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Sparkles, Globe, Zap, MapPin, Loader2
} from "lucide-react";
import Header from "@/components/layout/Header";
import { useNotifications } from "@/hooks/useNotifications";
import SearchModal from "@/components/layout/SearchModal";
import DashboardFABs from "@/components/layout/DashboardFABs";
import GlobalLocationModal from "@/components/location/GlobalLocationModal";
import LocationPermissionBanner from "@/components/location/LocationPermissionBanner";
import HomeAds from "@/components/home/HomeAds";
import FloatingProductCard from "@/components/home/FloatingProductCard";
import AutoScrollCarousel from "@/components/home/AutoScrollCarousel";
import ShopNearMe from "@/components/home/ShopNearMe";
import TodayBestDeals from "@/components/home/TodayBestDeals";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import PopularThisWeek from "@/components/home/PopularThisWeek";
import BoostedProducts from "@/components/home/BoostedProducts";
import HomeReels from "@/components/home/HomeReels";
import InsightsHomeSlider from "@/components/home/InsightsHomeSlider";
import ServicesSection from "@/components/connect/ServicesSection";
import ReferralBanner from "@/components/referral/ReferralBanner";
import ProfileCompletionBanner from "@/components/auth/ProfileCompletionBanner";
import CategoryCarousel from "@/components/home/CategoryCarousel";
import HomeCategoriesGrid from "@/components/home/HomeCategoriesGrid";
import FeatureGate from "@/components/system/FeatureGate";
import { useFeature } from "@/hooks/useFeatureFlags";
import { useAuth } from "@/hooks/useAuth";
import { useDynamicHomeFeed } from "@/hooks/useDynamicHomeFeed";
import { useGeo } from "@/context/GeoContext";
import { useViewPreference } from "@/hooks/useViewPreference";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const getCountryFlag = (code: string | null) => {
  if (!code || code.length !== 2) return '🌍';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0))
  );
};

const Index = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { unreadCount } = useNotifications();
  const { country, countryCode, currencySymbol, lat, lng, permissionDenied, requestLocationPermission, loading: geoLoading } = useGeo();
  const { preference, updatePreference, isCountryOnly } = useViewPreference();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  // When preference is 'global', pass null to show all products
  // When preference is 'country_only', pass the detected country
  const feedCountry = isCountryOnly ? country : null;
  
  const { 
    dynamicFeed,
    newArrivals,
    categorySections,
    loading,
    loadingMore,
    hasMore,
    loadMore,
  } = useDynamicHomeFeed(feedCountry);

  const isSeller = profile?.user_type === 'seller';
  const newArrivalsEnabled = useFeature('new_arrivals');

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const handleSentinelRef = useCallback((node: HTMLDivElement | null) => {
    sentinelRef.current = node;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loadingMore && !loading) {
        if (hasMore) {
          loadMore();
        } else {
          // Endless mode: repeat already loaded products
          setRepeatCycle(c => c + 1);
        }
      }
    }, { rootMargin: '1500px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadMore]);

  const [repeatCycle, setRepeatCycle] = useState(0);

  const ProductSkeleton = () => (
    <div className="bg-card rounded-2xl p-3 space-y-3 shadow-sm border border-border/30">
      <Skeleton className="aspect-square rounded-xl" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 pb-8 pt-14">
      <Header onSearchClick={() => setIsSearchOpen(true)} notificationCount={unreadCount} />
      
      <main className="container px-4 py-4 space-y-6">
        {/* Location Header */}
        <section className="animate-fade-up">
          <button
            onClick={() => setShowLocationModal(true)}
            className={cn(
              "w-full flex items-center gap-3 p-3.5 rounded-2xl",
              "bg-gradient-to-r from-primary/8 via-secondary/5 to-primary/8",
              "border border-primary/15 hover:border-primary/30 transition-all shadow-sm hover:shadow-md"
            )}
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
              <span className="text-xl">{getCountryFlag(countryCode)}</span>
            </div>
            <div className="flex-1 text-left">
              <p className="text-[11px] text-muted-foreground font-medium">
                {isCountryOnly ? '📍 Products from' : '🌍 Showing all products'}
              </p>
              <p className="font-bold text-foreground text-sm">
                {geoLoading ? 'Detecting...' : (isCountryOnly ? (country || 'Your Country') : 'All Countries')}
                {currencySymbol && isCountryOnly && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">({currencySymbol})</span>
                )}
              </p>
            </div>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Country Filter Toggle */}
          {country && (
            <div className="flex items-center justify-center gap-3 mt-3 p-2.5 rounded-xl bg-muted/40 border border-border/30">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">
                Show only products from <span className="font-semibold text-foreground">{country}</span>
              </span>
              <Switch
                checked={isCountryOnly}
                onCheckedChange={(checked) => updatePreference(checked ? 'country_only' : 'global')}
                className="ml-auto"
              />
            </div>
          )}
        </section>

        {/* Permission Banner */}
        {permissionDenied && (
          <section className="animate-fade-up">
            <LocationPermissionBanner onRequestPermission={requestLocationPermission} />
          </section>
        )}

        <ReferralBanner />
        <ProfileCompletionBanner />

        {/* Ads */}
        <section className="animate-fade-up">
          <HomeAds />
        </section>

        {/* Categories grid — Redis-first, restored */}
        <FeatureGate feature="categories_section">
          <HomeCategoriesGrid />
        </FeatureGate>

        {/* P4NO Connect — quick promo so users find services easily */}
        <section className="animate-fade-up">
          <button
            onClick={() => navigate('/connect')}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-primary via-orange-500 to-amber-500 text-white shadow-lg active:scale-[0.99] transition-transform"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl">
              💼
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-sm flex items-center gap-2">
                P4NO Connect
                <span className="px-1.5 py-0.5 rounded-full bg-white/25 text-[9px] font-bold">NEW</span>
              </p>
              <p className="text-[11px] opacity-90">Find trusted service providers near you</p>
            </div>
            <span className="text-white/80">›</span>
          </button>
        </section>

        {/* Featured */}
        <BoostedProducts />
        <FeatureGate feature="reels_module">
          <HomeReels />
        </FeatureGate>
        <FeatureGate feature="articles_module">
          <InsightsHomeSlider />
        </FeatureGate>
        <ServicesSection />
        <FeaturedProducts userCountry={feedCountry} />
        <FeatureGate feature="popular_this_week">
          <PopularThisWeek />
        </FeatureGate>

        {/* New Arrivals */}
        {newArrivalsEnabled && newArrivals.length > 0 && (
          <section className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <AutoScrollCarousel
              title="New Arrivals"
              icon="✨"
              color="from-blue-600 to-cyan-500"
              products={newArrivals}
              viewAllLink="/category/new-arrivals"
              autoScrollInterval={3000}
              badgeLabel="NEW"
              badgeTone="new"
              refSource="new_arrivals"
            />
          </section>
        )}

        {/* Category Sections */}
        {!loading && categorySections.map((section, idx) => (
          <section key={section.category.slug} className="animate-fade-up" style={{ animationDelay: `${0.18 + idx * 0.03}s` }}>
            <AutoScrollCarousel
              title={section.category.name}
              icon={section.category.icon || '📦'}
              color={section.color}
              products={section.products}
              viewAllLink={`/category/${section.category.slug}`}
              autoScrollInterval={3500 + idx * 500}
            />
          </section>
        ))}

        {/* Today's Best Deals (cheapest products) */}
        <FeatureGate feature="best_deals">
          <section className="animate-fade-up" style={{ animationDelay: "0.25s" }}>
            <TodayBestDeals userCountry={feedCountry} />
          </section>
        </FeatureGate>

        {/* Shop Near Me */}
        <FeatureGate feature="homepage_shop_section">
          <section className="animate-fade-up" style={{ animationDelay: "0.28s" }}>
            <ShopNearMe userCountry={isCountryOnly ? country || undefined : undefined} />
          </section>
        </FeatureGate>

        {/* Dynamic Feed */}
        <section className="space-y-5">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md shadow-primary/20">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base">Explore Products</h2>
              <p className="text-[10px] text-muted-foreground">Discover something new</p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => <ProductSkeleton key={i} />)}
            </div>
          ) : (
            <div className="space-y-6">
              {dynamicFeed.map((item, index) => (
                <div key={`feed-${index}`}>
                  {item.type === 'products' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {(item.data as any[]).map((product) => (
                        <FloatingProductCard
                          key={product.id}
                          id={product.id}
                          title={product.title}
                          price={product.price}
                          images={product.images}
                          rentalUnit={product.rental_unit}
                          isSponsored={product.sponsored}
                          isAdminPosted={product.admin_posted}
                          isNegotiable={product.is_negotiable}
                          currencySymbol={product.currency_symbol}
                          discount={product.discount}
                          discountExpiry={product.discount_expiry}
                        />
                      ))}
                    </div>
                  ) : (
                    <CategoryCarousel
                      categoryName={(item.data as any).category.name}
                      categorySlug={(item.data as any).category.slug}
                      categoryIcon={(item.data as any).category.icon || '📦'}
                      categoryColor={(item.data as any).color}
                      products={(item.data as any).products}
                    />
                  )}
                </div>
              ))}
              {/* Endless repeat loop once all loaded */}
              {!hasMore && repeatCycle > 0 && Array.from({ length: repeatCycle }).map((_, cycle) => (
                <div key={`repeat-${cycle}`} className="space-y-6">
                  {dynamicFeed.map((item, index) => (
                    <div key={`repeat-${cycle}-${index}`}>
                      {item.type === 'products' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                          {(item.data as any[]).map((product, pi) => (
                            <FloatingProductCard
                              key={`r-${cycle}-${product.id}-${pi}`}
                              id={product.id}
                              title={product.title}
                              price={product.price}
                              images={product.images}
                              rentalUnit={product.rental_unit}
                              isSponsored={product.sponsored}
                              isAdminPosted={product.admin_posted}
                              isNegotiable={product.is_negotiable}
                              currencySymbol={product.currency_symbol}
                              discount={product.discount}
                              discountExpiry={product.discount_expiry}
                            />
                          ))}
                        </div>
                      ) : (
                        <CategoryCarousel
                          categoryName={(item.data as any).category.name}
                          categorySlug={(item.data as any).category.slug}
                          categoryIcon={(item.data as any).category.icon || '📦'}
                          categoryColor={(item.data as any).color}
                          products={(item.data as any).products}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Bottom Ads */}
        <section className="animate-fade-up">
          <HomeAds />
        </section>

        {/* Infinite scroll sentinel — never ends, repeats products */}
        {!loading && dynamicFeed.length > 0 && (
          <div ref={handleSentinelRef} className="h-12 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {/* Empty State */}
        {!loading && dynamicFeed.length === 0 && (
          <section className="animate-fade-up">
            <div className="text-center py-16 bg-gradient-to-br from-muted/40 to-muted/20 rounded-2xl border border-border/30">
              <Sparkles className="h-12 w-12 text-primary/40 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">
                {isCountryOnly 
                  ? `No products in ${country || 'your area'}.` 
                  : 'No products available yet. Check back soon!'
                }
              </p>
              {isCountryOnly && (
                <Button 
                  variant="outline" 
                  className="mt-4 rounded-full"
                  onClick={() => updatePreference('global')}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Show Global Products
                </Button>
              )}
            </div>
          </section>
        )}

        {/* Footer */}
        <section className="text-center py-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">Smart Shopping</span>
          </div>
        </section>
      </main>

      <DashboardFABs showSeller={isSeller} />
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <GlobalLocationModal 
        isOpen={showLocationModal} 
        onClose={() => setShowLocationModal(false)}
      />
    </div>
  );
};

export default Index;
