import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Home, MessageCircle, Package, Clock, CheckCircle2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminOrders } from "@/hooks/useOrders";
import { format } from "date-fns";

const AdminOrders = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { orders, loading } = useAdminOrders();
  const [filter, setFilter] = useState<string>('all');

  if (adminLoading || loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Package className="h-8 w-8 animate-pulse text-primary" /></div>;
  }
  if (!isAdmin) { navigate('/'); return null; }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  const notifySeller = (order: any) => {
    const phone = order.profiles?.whatsapp_number;
    if (!phone) return;
    const msg = encodeURIComponent(`You have a new order on P4no. Please check your seller dashboard. Order from: ${order.buyer_name}`);
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin')} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center"><ArrowLeft className="h-4 w-4" /></button>
            <h1 className="font-bold text-lg">All Orders</h1>
          </div>
          <button onClick={() => navigate('/')} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center"><Home className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto">
          {['all', 'pending', 'contacted', 'completed'].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${filter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>No orders found</p>
          </div>
        )}

        {filtered.map(order => (
          <div key={order.id} className="bg-card rounded-2xl border p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">{order.buyer_name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{order.buyer_phone}</p>
              </div>
              <Badge className={order.status === 'pending' ? 'bg-amber-100 text-amber-700' : order.status === 'contacted' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>
                {order.status}
              </Badge>
            </div>

            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
            </div>

            <div className="text-xs text-muted-foreground">
              Seller: <span className="font-medium text-foreground">{order.profiles?.full_name || 'Unknown'}</span>
            </div>

            {/* Items */}
            <div className="space-y-2">
              {order.order_items?.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 bg-muted/50 rounded-xl p-2">
                  <img src={item.products?.images?.[0] || '/placeholder.svg'} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium line-clamp-1">{item.products?.title}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity} × {item.products?.currency_symbol || 'Fr'} {item.unit_price}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              size="sm"
              onClick={() => notifySeller(order)}
              className="w-full gap-2 rounded-xl bg-green-600 hover:bg-green-700 text-white"
            >
              <MessageCircle className="h-4 w-4" />
              Notify Seller on WhatsApp
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminOrders;
