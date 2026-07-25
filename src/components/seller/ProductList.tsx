import { useState } from "react";
import { Package, Edit, Trash2, MoreVertical, Rocket, Tag, Percent, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSellerBoosts } from "@/hooks/useBoostedProducts";
import BoostProductModal from "@/components/seller/BoostProductModal";
import DiscountModal from "@/components/discount/DiscountModal";
import BulkDiscountModal from "@/components/discount/BulkDiscountModal";
import DiscountCountdown from "@/components/discount/DiscountCountdown";
import { hasActiveDiscount, getDiscountedPrice } from "@/lib/discount";

interface ProductListProps {
  products: any[];
  loading: boolean;
  onEdit: (product: any) => void;
  onRefresh: () => void;
}

const ProductList = ({ products, loading, onEdit, onRefresh }: ProductListProps) => {
  const { toast } = useToast();
  const { requestBoost } = useSellerBoosts();
  const [boostProduct, setBoostProduct] = useState<any>(null);
  const [discountProduct, setDiscountProduct] = useState<any>(null);
  const [showBulkDiscount, setShowBulkDiscount] = useState(false);

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      // Get product images before deleting
      const { data: product } = await supabase
        .from('products')
        .select('images')
        .eq('id', productId)
        .single();

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      // Delete images from Cloudinary
      if (product?.images?.length) {
        for (const imageUrl of product.images) {
          if (imageUrl && imageUrl.includes('cloudinary.com')) {
            try {
              // Extract public_id from URL
              const parts = imageUrl.split('/upload/');
              if (parts[1]) {
                const publicId = parts[1].replace(/^[^/]+\//, '').replace(/\.[^.]+$/, '');
                // Note: Cloudinary deletion requires API secret (server-side only)
                // For now, images will remain in Cloudinary storage
                console.log('Image to clean up:', publicId);
              }
            } catch { /* ignore cleanup errors */ }
          }
        }
      }

      toast({ title: "Product deleted" });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    }
  };

  const handleShare = async (product: any) => {
    const slug = product.slug || product.id;
    const url = `https://p4no-marketplace.vercel.app/p/${slug}`;
    const text = `Check out ${product.title} on p4no!`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: product.title, text, url });
        toast({ title: "Shared successfully!" });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied!", description: "Product link copied to clipboard." });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold mb-2">No Products Yet</h3>
        <p className="text-muted-foreground text-sm">
          Add your first product to start selling
        </p>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-3">
      {/* Bulk Discount Button */}
      {products.length > 1 && (
        <Button
          variant="outline"
          onClick={() => setShowBulkDiscount(true)}
          className="w-full gap-2 rounded-xl h-11 border-primary/30 text-primary hover:bg-primary/5"
        >
          <Percent className="h-4 w-4" />
          Apply Discount to All Products ({products.length})
        </Button>
      )}
      {products.map(product => (
        <div key={product.id} className="bg-card rounded-xl p-3 border flex items-center gap-3">
          <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
            <img 
              src={product.images?.[0] || '/placeholder.svg'} 
              alt={product.title}
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm line-clamp-1">{product.title}</h3>
              <div className="flex items-center gap-1 shrink-0">
                {/* Share button visible directly */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleShare(product)}
                >
                  <Share2 className="h-4 w-4 text-primary" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(product)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(product.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setBoostProduct(product)}>
                      <Rocket className="h-4 w-4 mr-2" />
                      Boost
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDiscountProduct(product)}>
                      <Tag className="h-4 w-4 mr-2" />
                      {hasActiveDiscount(product.discount, product.discount_expiry) ? 'Edit Discount' : 'Add Discount'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            <p className="text-primary font-bold text-sm mt-1">
              {product.is_negotiable || product.price <= 0 ? 'Price Negotiable' : (
                hasActiveDiscount(product.discount, product.discount_expiry) ? (
                  <span className="flex items-center gap-2">
                    <span className="line-through text-muted-foreground font-normal text-xs">{formatPrice(product.price)}</span>
                    <span className="text-blue-600 dark:text-blue-400">{formatPrice(getDiscountedPrice(product.price, product.discount!))}</span>
                    <Badge className="text-[10px] bg-destructive text-destructive-foreground">-{product.discount}%</Badge>
                  </span>
                ) : formatPrice(product.price)
              )}
            </p>
            
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                Qty: {product.quantity}
              </Badge>
              {product.is_negotiable && (
                <Badge className="text-xs bg-primary/10 text-primary">
                  Negotiable
                </Badge>
              )}
              {hasActiveDiscount(product.discount, product.discount_expiry) && (
                <DiscountCountdown expiryDate={product.discount_expiry!} compact />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Boost Modal */}
    {boostProduct && (
      <BoostProductModal
        isOpen={!!boostProduct}
        onClose={() => setBoostProduct(null)}
        productTitle={boostProduct.title}
        onSubmit={async (days, planId, costPoints) => {
          await requestBoost(boostProduct.id, days, planId, costPoints);
          setBoostProduct(null);
        }}
      />
    )}

    {/* Discount Modal */}
    {discountProduct && (
      <DiscountModal
        isOpen={!!discountProduct}
        onClose={() => setDiscountProduct(null)}
        product={discountProduct}
        onSuccess={onRefresh}
      />
    )}

    {/* Bulk Discount Modal */}
    <BulkDiscountModal
      isOpen={showBulkDiscount}
      onClose={() => setShowBulkDiscount(false)}
      products={products.map(p => ({ id: p.id, title: p.title, price: p.price }))}
      onSuccess={onRefresh}
    />
    </>
  );
};

export default ProductList;
