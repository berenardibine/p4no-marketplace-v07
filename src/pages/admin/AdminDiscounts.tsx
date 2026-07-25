import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Home, Search, Filter, Tag, Edit, Trash2, 
  Clock, ChevronRight, AlertCircle, CheckCircle2, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import DiscountModal from "@/components/discount/DiscountModal";
import DiscountCountdown from "@/components/discount/DiscountCountdown";
import { hasActiveDiscount, getDiscountedPrice } from "@/lib/discount";

const AdminDiscounts = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");
  const [editProduct, setEditProduct] = useState<any>(null);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id, title, price, images, discount, discount_expiry, seller_id, currency_symbol, profiles!products_seller_id_fkey(full_name)")
      .order("discount_expiry", { ascending: false, nullsFirst: false });

    if (!error && data) {
      setProducts(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchProducts();
  }, [isAdmin]);

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Access denied</p>
      </div>
    );
  }

  const now = new Date();
  const filtered = products.filter(p => {
    const isActive = hasActiveDiscount(p.discount, p.discount_expiry);
    const hasDiscount = p.discount && p.discount > 0;
    const isExpired = hasDiscount && p.discount_expiry && new Date(p.discount_expiry) <= now;
    const noDiscount = !hasDiscount;

    if (filter === "active" && !isActive) return false;
    if (filter === "expired" && !isExpired) return false;
    if (filter === "none" && !noDiscount) return false;

    if (search) {
      const s = search.toLowerCase();
      return p.title?.toLowerCase().includes(s) || p.profiles?.full_name?.toLowerCase().includes(s);
    }
    return true;
  });

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('en-RW', { minimumFractionDigits: 0 }).format(amount);

  const totalActive = products.filter(p => hasActiveDiscount(p.discount, p.discount_expiry)).length;

  const handleRemoveDiscount = async (productId: string) => {
    if (!confirm("Remove discount from this product?")) return;
    const { error } = await supabase
      .from("products")
      .update({ discount: 0, discount_expiry: null })
      .eq("id", productId);

    if (error) {
      toast({ title: "Failed to remove discount", variant: "destructive" });
    } else {
      toast({ title: "Discount removed" });
      fetchProducts();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 pb-24">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/admin")} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="font-bold text-lg">Discounts</h1>
          </div>
          <button onClick={() => navigate("/")} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
            <Home className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl p-4 border">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-destructive to-destructive/80 flex items-center justify-center mb-2">
              <Tag className="h-5 w-5 text-destructive-foreground" />
            </div>
            <p className="text-2xl font-bold">{totalActive}</p>
            <p className="text-sm text-muted-foreground">Active Discounts</p>
          </div>
          <div className="bg-card rounded-2xl p-4 border">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-muted to-muted/80 flex items-center justify-center mb-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{products.filter(p => p.discount && p.discount > 0 && p.discount_expiry && new Date(p.discount_expiry) <= now).length}</p>
            <p className="text-sm text-muted-foreground">Expired</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search product or seller..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">Active</TabsTrigger>
            <TabsTrigger value="expired" className="flex-1">Expired</TabsTrigger>
            <TabsTrigger value="none" className="flex-1">No Discount</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Product List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No products found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(product => {
              const isActive = hasActiveDiscount(product.discount, product.discount_expiry);
              const discountedPrice = isActive ? getDiscountedPrice(product.price, product.discount) : product.price;

              return (
                <div key={product.id} className="bg-card rounded-xl p-3 border flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                    <img
                      src={product.images?.[0] || "/placeholder.svg"}
                      alt={product.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm line-clamp-1">{product.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      Seller: {product.profiles?.full_name || "Unknown"}
                    </p>

                    {isActive ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="text-[10px] bg-destructive text-destructive-foreground">-{product.discount}%</Badge>
                        <span className="text-xs line-through text-muted-foreground">
                          {formatPrice(product.price)}
                        </span>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                          {formatPrice(discountedPrice)}
                        </span>
                        <DiscountCountdown expiryDate={product.discount_expiry} compact />
                      </div>
                    ) : product.discount && product.discount > 0 ? (
                      <Badge variant="outline" className="text-[10px] mt-1">Expired -{product.discount}%</Badge>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">{formatPrice(product.price)}</p>
                    )}
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditProduct(product)}
                    >
                      {isActive ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </Button>
                    {isActive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveDiscount(product.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Discount Modal */}
      {editProduct && (
        <DiscountModal
          isOpen={!!editProduct}
          onClose={() => setEditProduct(null)}
          product={editProduct}
          onSuccess={fetchProducts}
        />
      )}
    </div>
  );
};

export default AdminDiscounts;
