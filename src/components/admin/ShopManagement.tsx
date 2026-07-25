import { useState, useEffect } from "react";
import { 
  Store, Users, Package, MapPin, Search, MoreVertical,
  Trash2, Ban, Edit, Eye, CheckCircle, Phone, Mail, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const ShopManagement = () => {
  const { toast } = useToast();
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedShop, setSelectedShop] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    description: '',
    trading_center: '',
    phone_number: '',
    whatsapp_number: '',
  });

  const fetchShops = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('shops')
      .select(`
        *,
        owner:profiles!shops_seller_id_fkey(id, full_name, email, phone_number)
      `)
      .order('created_at', { ascending: false });
    
    if (data) setShops(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchShops();
  }, []);

  const filteredShops = shops.filter(s => 
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.owner?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.trading_center?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteShop = async (id: string) => {
    if (!confirm('Are you sure? This will also remove all products from this shop.')) return;
    
    const { error } = await supabase.from('shops').delete().eq('id', id);
    
    if (error) {
      toast({ title: "Failed to delete shop", variant: "destructive" });
    } else {
      toast({ title: "Shop deleted successfully" });
      fetchShops();
      setShowDetailDialog(false);
    }
  };

  const handleBlockShop = async (id: string) => {
    // Block shop and set all its products to inactive
    const { error: shopError } = await supabase
      .from('shops')
      .update({ is_active: false })
      .eq('id', id);

    if (!shopError) {
      await supabase
        .from('products')
        .update({ status: 'blocked' })
        .eq('shop_id', id);

      toast({ title: "Shop blocked! All products are now offline." });
      fetchShops();
    } else {
      toast({ title: "Failed to block shop", variant: "destructive" });
    }
  };

  const handleActivateShop = async (id: string) => {
    const { error } = await supabase
      .from('shops')
      .update({ is_active: true })
      .eq('id', id);

    if (!error) {
      // Also reactivate products
      await supabase
        .from('products')
        .update({ status: 'active' })
        .eq('shop_id', id);

      toast({ title: "Shop activated!" });
      fetchShops();
    }
  };

  const openEditDialog = (shop: any) => {
    setSelectedShop(shop);
    setEditData({
      name: shop.name || '',
      description: shop.description || '',
      trading_center: shop.trading_center || '',
      phone_number: shop.phone_number || '',
      whatsapp_number: shop.whatsapp_number || '',
    });
    setShowEditDialog(true);
  };

  const handleEditShop = async () => {
    if (!selectedShop) return;

    const updatePayload: any = { ...editData };
    // Map field names to match DB columns
    if ('phone_number' in updatePayload) {
      updatePayload.contact_phone = updatePayload.phone_number;
      delete updatePayload.phone_number;
    }
    if ('whatsapp_number' in updatePayload) {
      updatePayload.whatsapp = updatePayload.whatsapp_number;
      delete updatePayload.whatsapp_number;
    }

    const { error } = await supabase
      .from('shops')
      .update(updatePayload)
      .eq('id', selectedShop.id);

    if (error) {
      toast({ title: "Failed to update shop", variant: "destructive" });
    } else {
      toast({ title: "Shop updated!" });
      fetchShops();
      setShowEditDialog(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search shops by name, owner, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
        </div>
        <Button variant="outline" size="icon" className="h-12 w-12" onClick={fetchShops}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
            <Store className="h-4 w-4" />
            <span className="text-xs font-medium">Total Shops</span>
          </div>
          <p className="text-2xl font-bold">{shops.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Active</span>
          </div>
          <p className="text-2xl font-bold">{shops.filter(s => s.is_active !== false).length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
            <Ban className="h-4 w-4" />
            <span className="text-xs font-medium">Blocked</span>
          </div>
          <p className="text-2xl font-bold">{shops.filter(s => s.is_active === false).length}</p>
        </div>
      </div>

      {/* Shop List */}
      <div className="bg-card rounded-2xl border overflow-hidden">
        <div className="p-4 border-b bg-gradient-to-r from-primary/10 to-transparent">
          <h3 className="font-semibold">All Shops ({filteredShops.length})</h3>
        </div>
        <div className="divide-y max-h-[500px] overflow-y-auto">
          {loading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="p-4">
                <Skeleton className="h-20" />
              </div>
            ))
          ) : filteredShops.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No shops found
            </div>
          ) : (
            filteredShops.map(shop => (
              <div key={shop.id} className="p-4 flex items-start gap-4 hover:bg-accent transition-colors">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center overflow-hidden">
                  {shop.logo_url ? (
                    <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover" />
                  ) : (
                    <Store className="h-6 w-6 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{shop.name}</p>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Users className="h-3 w-3" />
                    <span>{shop.owner?.full_name || 'Unknown Owner'}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{shop.trading_center || 'No location'}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      <Package className="h-3 w-3 mr-1" />
                      Products
                    </Badge>
                    <Badge 
                      className={cn(
                        "text-xs",
                        (shop.is_active !== false)
                          ? "bg-green-100 text-green-700" 
                          : "bg-red-100 text-red-700"
                      )}
                    >
                      {shop.is_active !== false ? 'active' : 'blocked'}
                    </Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover">
                    <DropdownMenuItem onClick={() => {
                      setSelectedShop(shop);
                      setShowDetailDialog(true);
                    }}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEditDialog(shop)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleActivateShop(shop.id)}>
                      <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                      Activate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBlockShop(shop.id)}>
                      <Ban className="h-4 w-4 mr-2 text-yellow-600" />
                      Block Shop
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDeleteShop(shop.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Shop Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="bg-card max-w-md">
          <DialogHeader>
            <DialogTitle>Shop Details</DialogTitle>
          </DialogHeader>
          {selectedShop && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center overflow-hidden">
                  {selectedShop.logo_url ? (
                    <img src={selectedShop.logo_url} alt={selectedShop.name} className="w-full h-full object-cover" />
                  ) : (
                    <Store className="h-8 w-8 text-white" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-lg">{selectedShop.name}</p>
                  <p className="text-muted-foreground text-sm">{selectedShop.owner?.full_name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Phone className="h-3 w-3" />
                    <span className="text-xs">Phone</span>
                  </div>
                  <p className="font-medium text-sm">{selectedShop.phone_number || selectedShop.owner?.phone_number || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Mail className="h-3 w-3" />
                    <span className="text-xs">Email</span>
                  </div>
                  <p className="font-medium text-sm truncate">{selectedShop.owner?.email || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <MapPin className="h-3 w-3" />
                    <span className="text-xs">Location</span>
                  </div>
                  <p className="font-medium text-sm">{selectedShop.trading_center || 'N/A'}</p>
                </div>
              </div>

              {selectedShop.description && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{selectedShop.description}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button className="flex-1" variant="outline" onClick={() => openEditDialog(selectedShop)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => handleBlockShop(selectedShop.id)}
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Block
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Shop Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Edit Shop</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Shop Name</label>
              <Input
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Trading Center / Location</label>
              <Input
                value={editData.trading_center}
                onChange={(e) => setEditData({ ...editData, trading_center: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Phone Number</label>
              <Input
                value={editData.phone_number}
                onChange={(e) => setEditData({ ...editData, phone_number: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">WhatsApp Number</label>
              <Input
                value={editData.whatsapp_number}
                onChange={(e) => setEditData({ ...editData, whatsapp_number: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditShop}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShopManagement;
