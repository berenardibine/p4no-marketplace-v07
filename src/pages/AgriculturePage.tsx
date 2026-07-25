import { useState, useMemo } from 'react';
import { Wheat } from 'lucide-react';
import Header from '@/components/layout/Header';
import SearchModal from '@/components/layout/SearchModal';
import SellerFAB from '@/components/layout/SellerFAB';
import AdminFAB from '@/components/layout/AdminFAB';
import FloatingProductCard from '@/components/home/FloatingProductCard';
import HomeAds from '@/components/home/HomeAds';
import GlobalLocationModal from '@/components/location/GlobalLocationModal';
import LocationPermissionBanner from '@/components/location/LocationPermissionBanner';
import { useAuth } from '@/hooks/useAuth';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useGeo } from '@/context/GeoContext';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const AgriculturePage = () => {
  const { profile } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState('all');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const { country, permissionDenied, requestLocationPermission } = useGeo();
  
  const { categories: dbCategories, loading: categoriesLoading } = useCategories('agriculture');
  const { products, loading } = useProducts('agriculture');
  
  const isSeller = profile?.user_type === 'seller';

  const subcategories = useMemo(() => {
    const allOption = { id: 'all', name: 'All Agriculture', slug: 'all', icon: '✨', type: 'agriculture' };
    return [allOption, ...dbCategories];
  }, [dbCategories]);

  const filteredProducts = selectedSub === 'all' 
    ? products 
    : products.filter(p => p.category === selectedSub);

  const ProductSkeleton = () => (
    <div className="bg-card rounded-2xl p-3 space-y-3 shadow-[0_6px_12px_rgba(0,0,0,0.08)]">
      <Skeleton className="aspect-square rounded-xl" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-green-500/5 pb-8 pt-14">
      <Header onSearchClick={() => setIsSearchOpen(true)} />
      
      <main className="container px-4 py-4 space-y-4">
        {/* Location Permission Banner */}
        {permissionDenied && (
          <LocationPermissionBanner onRequestPermission={requestLocationPermission} />
        )}

        {/* Ads */}
        <HomeAds />

        {/* Page Title */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center">
            <Wheat className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Agriculture</h1>
            <p className="text-sm text-muted-foreground">Fresh Farm Products & Tools</p>
          </div>
        </div>

        {/* Subcategory Filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
          {categoriesLoading ? (
            Array(4).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-full shrink-0" />
            ))
          ) : (
            subcategories.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSelectedSub(sub.slug)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0",
                  selectedSub === sub.slug
                    ? "bg-green-500 text-white shadow-lg"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                <span>{sub.icon}</span>
                {sub.name}
              </button>
            ))
          )}
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => <ProductSkeleton key={i} />)}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredProducts.map((product) => (
              <FloatingProductCard
                key={product.id}
                id={product.id}
                title={product.title}
                price={product.price}
                images={product.images}
                isNegotiable={product.is_negotiable}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-muted/30 rounded-2xl">
            <Wheat className="h-16 w-16 text-green-500/50 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No Agriculture Products Yet</h3>
            <p className="text-muted-foreground">Be the first to list farm products in your area!</p>
          </div>
        )}
      </main>

      {isSeller && <SellerFAB />}
      <AdminFAB />
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <GlobalLocationModal 
        isOpen={showLocationModal} 
        onClose={() => setShowLocationModal(false)}
      />
    </div>
  );
};

export default AgriculturePage;
