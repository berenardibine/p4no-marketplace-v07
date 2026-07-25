import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Package, Search, MoreVertical, Trash2, Edit, Eye, 
  Plus, RefreshCw, CheckCircle, Clock, Sparkles, ArrowLeft, Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCategories } from "@/hooks/useCategories";
import { useAdmin } from "@/hooks/useAdmin";
import { cn } from "@/lib/utils";

const AdminProducts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  const { categories: dbCategories } = useCategories();

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select(`
        *,
        seller:profiles!products_seller_id_fkey(id, full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    setProducts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) {
      fetchProducts();
    }
  }, [isAdmin]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    const { error } = await supabase.from('products').delete().eq('id', id);
    
    if (error) {
      toast({ title: "Failed to delete product", variant: "destructive" });
    } else {
      toast({ title: "Product deleted successfully" });
      fetchProducts();
    }
  };

  const handleApproveProduct = async (id: string) => {
    const { error } = await supabase.from('products').update({ status: 'active' }).eq('id', id);
    
    if (error) {
      toast({ title: "Failed to approve product", variant: "destructive" });
    } else {
      toast({ title: "Product approved" });
      fetchProducts();
    }
  };

  const categoryOptions = [
    { value: 'all', label: 'All' },
    ...dbCategories.map(c => ({ value: c.slug, label: c.name }))
  ];

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={() => navigate('/admin')}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">Products</h1>
            <p className="text-xs text-muted-foreground">{products.length} total</p>
          </div>
          <Button 
            onClick={() => navigate('/admin/products/add')}
            className="rounded-xl gap-2"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Search */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 rounded-xl bg-card"
            />
          </div>
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl" onClick={fetchProducts}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-card rounded-xl p-3 border">
            <Package className="h-4 w-4 text-primary mb-1" />
            <p className="text-lg font-bold">{products.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="bg-card rounded-xl p-3 border">
            <CheckCircle className="h-4 w-4 text-green-600 mb-1" />
            <p className="text-lg font-bold">{products.filter(p => p.status === 'active').length}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="bg-card rounded-xl p-3 border">
            <Tag className="h-4 w-4 text-amber-600 mb-1" />
            <p className="text-lg font-bold">{products.filter(p => p.admin_posted).length}</p>
            <p className="text-xs text-muted-foreground">Admin</p>
          </div>
          <div className="bg-card rounded-xl p-3 border">
            <Sparkles className="h-4 w-4 text-purple-600 mb-1" />
            <p className="text-lg font-bold">{products.filter(p => p.sponsored).length}</p>
            <p className="text-xs text-muted-foreground">Featured</p>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {categoryOptions.slice(0, 8).map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                categoryFilter === cat.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground border hover:bg-muted"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Product List */}
        <div className="space-y-3">
          {loading ? (
            Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No products found
            </div>
          ) : (
            filteredProducts.map(product => (
              <div key={product.id} className="bg-card rounded-xl p-3 border flex items-center gap-3">
                <img 
                  src={product.images?.[0] || '/placeholder.svg'}
                  alt={product.title}
                  className="w-16 h-16 rounded-xl object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate text-sm">{product.title}</p>
                    {product.admin_posted && (
                      <Badge className="bg-amber-100 text-amber-700 text-xs">Admin</Badge>
                    )}
                    {product.sponsored && (
                      <Badge className="bg-purple-100 text-purple-700 text-xs">Featured</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {product.seller?.full_name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge 
                      className={cn(
                        "text-xs",
                        product.status === 'active' 
                          ? "bg-green-100 text-green-700" 
                          : "bg-yellow-100 text-yellow-700"
                      )}
                    >
                      {product.status}
                    </Badge>
                    {product.rental_unit && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        /{product.rental_unit}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary text-sm">
                    {product.is_negotiable || product.price <= 0 ? 'Price Negotiable' : formatPrice(product.price)}
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card">
                      <DropdownMenuItem onClick={() => navigate(`/product/${product.slug || product.id}`)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/admin/products/edit/${product.id}`)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {product.status === 'pending' && (
                        <DropdownMenuItem onClick={() => handleApproveProduct(product.id)}>
                          <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                          Approve
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        onClick={() => handleDeleteProduct(product.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminProducts;
