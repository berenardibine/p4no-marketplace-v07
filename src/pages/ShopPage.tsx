import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getContent } from '@/lib/cdnGuard';
import { allowLastResortRead } from '@/lib/apiFirewall';
import FloatingProductCard from '@/components/home/FloatingProductCard';
import ProductJsonLd from '@/components/seo/ProductJsonLd';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Store, MapPin, Phone, MessageCircle, ArrowLeft, Package,
  ShieldCheck, ArrowUpDown, Loader2, Globe, Users
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import BottomNav from '@/components/layout/BottomNav';
import FollowButton from '@/components/social/FollowButton';
import { useFollow } from '@/hooks/useFollow';
import { logActivity } from '@/lib/activityEvents';

interface Shop {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  trading_center: string | null;
  contact_phone: string | null;
  whatsapp: string | null;
  seller_id: string;
}

interface SellerProfile {
  full_name: string;
  profile_image: string | null;
  identity_verified: boolean | null;
  location: string | null;
}

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  rental_unit: string | null;
  sponsored: boolean | null;
  is_negotiable: boolean | null;
  created_at: string | null;
  views: number | null;
}

type SortOption = 'newest' | 'popular' | 'price_low' | 'price_high';

const ShopPage = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [shop, setShop] = useState<Shop | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortOption>('newest');
  const [productCount, setProductCount] = useState(0);
  const loaderRef = useRef<HTMLDivElement>(null);
  const LIMIT = 20;
  const { count: followerCount } = useFollow('shop', shopId || null);

  const fetchShop = useCallback(async () => {
    if (!shopId) return;
    try {
      const { data } = await supabase
        .from('shops')
        .select('id, name, description, logo_url, trading_center, contact_phone, whatsapp, seller_id')
        .eq('id', shopId)
        .single();
      setShop(data);

      if (data?.seller_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, profile_image, identity_verified, location')
          .eq('id', data.seller_id)
          .single();
        setSeller(profile);
      }
    } catch (error) {
      console.error('Error fetching shop:', error);
    }
  }, [shopId]);

  const getSortConfig = (s: SortOption) => {
    switch (s) {
      case 'newest': return { column: 'created_at', ascending: false };
      case 'popular': return { column: 'views', ascending: false };
      case 'price_low': return { column: 'price', ascending: true };
      case 'price_high': return { column: 'price', ascending: false };
    }
  };

  // Static-first shop products: one CDN read of `shops/<key>/products.json`.
  // Falls back to a single sanctioned database read only if that file is not
  // published yet. No paging requests, no polling.
  const fetchProducts = useCallback(async () => {
    if (!shop?.id) return;
    setLoading(true);
    try {
      let rows: any[] | null = await getContent<any[]>(`shops/${shop.id}/products`);
      if (!rows && (shop as any).slug) {
        rows = await getContent<any[]>(`shops/${(shop as any).slug}/products`);
      }

      if (!Array.isArray(rows)) {
        allowLastResortRead('products');
        const { data } = await supabase
          .from('products')
          .select('id, title, price, images, rental_unit, sponsored, is_negotiable, created_at, views, shop_id, seller_id')
          .eq('status', 'active')
          .or(`shop_id.eq.${shop.id},seller_id.eq.${shop.seller_id}`)
          .order('created_at', { ascending: false })
          .limit(60);
        rows = (data || []).filter((p: any) => p.shop_id ? p.shop_id === shop.id : p.seller_id === shop.seller_id);
      }

      setProducts(rows as Product[]);
      setProductCount(rows.length);
      setHasMore(false);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [shop?.id, shop?.seller_id]);

  useEffect(() => { fetchShop(); }, [fetchShop]);

  useEffect(() => { if (shop?.id) fetchProducts(); }, [shop?.id, fetchProducts]);

  const sortedProducts = useMemo(() => {
    const cfg = getSortConfig(sort);
    return [...products].sort((a: any, b: any) => {
      const av = cfg.column === 'created_at' ? new Date(a.created_at || 0).getTime() : (a[cfg.column] || 0);
      const bv = cfg.column === 'created_at' ? new Date(b.created_at || 0).getTime() : (b[cfg.column] || 0);
      return cfg.ascending ? av - bv : bv - av;
    });
  }, [products, sort]);

  const handleWhatsApp = () => {
    if (shop?.whatsapp) {
      const msg = encodeURIComponent(`Hi! I found your shop on p4no.`);
      window.open(`https://wa.me/${shop.whatsapp.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
    }
  };

  const handleCall = () => {
    if (shop?.contact_phone) window.open(`tel:${shop.contact_phone}`, '_self');
  };

  // Loading skeleton
  if (loading && !shop) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="p-4 space-y-4">
          <Skeleton className="h-48 rounded-3xl" />
          <Skeleton className="h-6 w-1/2" />
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (!shop) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-sm bg-card rounded-3xl p-8 border shadow-xl">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Store className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold mb-2">Shop Not Found</h1>
          <p className="text-muted-foreground text-sm mb-6">This shop may have been removed or doesn't exist.</p>
          <Button onClick={() => navigate('/')} className="rounded-xl">Go Home</Button>
        </div>
      </div>
    );
  }

  const displayName = shop.name;
  const avatarUrl = shop.logo_url || seller?.profile_image;
  const isVerified = seller?.identity_verified;
  const locationText = shop.trading_center || seller?.location;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* SEO */}
      {shop && (
        <ProductJsonLd
          title={`${displayName} — p4no Shop`}
          description={shop.description || `Browse products from ${displayName} on p4no`}
          image={avatarUrl || '/og-image.jpg'}
          url={`https://p4no-marketplace.vercel.app/shop/${shop.id}`}
        />
      )}

      {/* Header Bar */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center gap-3 h-14 px-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-bold text-base flex-1 truncate">{displayName}</h1>
        </div>
      </div>

      {/* Shop Banner */}
      <div className="relative">
        <div className="h-32 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />
        <div className="px-4 -mt-12 relative z-10">
          <div className="flex items-end gap-4">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-2xl bg-card border-4 border-background flex items-center justify-center overflow-hidden shadow-xl shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <Store className="h-10 w-10 text-primary" />
              )}
            </div>
            <div className="flex-1 pb-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold truncate">{displayName}</h2>
                {isVerified && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1 shrink-0">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verified
                  </Badge>
                )}
              </div>
              {locationText && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{locationText}</span>
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          {shop.description && (
            <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{shop.description}</p>
          )}

          {/* Contact + Follow Buttons */}
          <div className="flex gap-3 mt-4 flex-wrap">
            <FollowButton targetType="shop" targetId={shopId} showCount className="flex-1 min-w-[120px] h-12" />
            {shop.contact_phone && (
              <Button variant="outline" onClick={handleCall} className="flex-1 gap-2 h-12 rounded-xl border-2">
                <Phone className="h-4 w-4" />
                Call
              </Button>
            )}
            {shop.whatsapp && (
              <Button onClick={handleWhatsApp} className="flex-1 gap-2 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
            )}
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-4 mt-4 pb-4 border-b border-border/50">
            <div className="flex items-center gap-1.5">
              <Package className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{productCount}</span>
              <span className="text-xs text-muted-foreground">Products</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{followerCount}</span>
              <span className="text-xs text-muted-foreground">{followerCount === 1 ? 'Follower' : 'Followers'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sort + Products */}
      <div className="px-4 pt-4">
        {/* Sort Bar */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Products
          </h3>
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="w-[140px] h-9 rounded-xl text-xs">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="popular">Popular</SelectItem>
              <SelectItem value="price_low">Price: Low</SelectItem>
              <SelectItem value="price_high">Price: High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-2xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 bg-muted/30 rounded-3xl">
            <Package className="h-14 w-14 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">No Products Yet</h3>
            <p className="text-sm text-muted-foreground">This shop hasn't listed any products.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {products.map((product) => (
                <FloatingProductCard
                  key={product.id}
                  id={product.id}
                  title={product.title}
                  price={product.price}
                  images={product.images}
                  rentalUnit={product.rental_unit}
                  isSponsored={product.sponsored}
                  isNegotiable={product.is_negotiable}
                />
              ))}
            </div>

            {/* Infinite scroll loader */}
            {hasMore && (
              <div ref={loaderRef} className="flex justify-center py-6">
                {loadingMore && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm">Loading more...</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ShopPage;
