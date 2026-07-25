import { useState, useEffect } from "react";
import { Package, Clock, CheckCircle2, User, Phone, MessageCircle, XCircle, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSellerOrders } from "@/hooks/useOrders";
import { format } from "date-fns";
import { sanitizePhone, openWhatsApp } from "@/lib/whatsappOrder";
import { motion, AnimatePresence } from "framer-motion";

const statusStyles: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  contacted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

const SellerOrdersTab = () => {
  const { orders, loading, updateOrderStatus, newCount, clearNewCount } = useSellerOrders();
  const [filter, setFilter] = useState<'all' | 'pending' | 'contacted' | 'completed' | 'cancelled'>('all');

  // Auto-clear "new" badge when seller views the tab
  useEffect(() => {
    if (newCount > 0) {
      const t = setTimeout(() => clearNewCount(), 1500);
      return () => clearTimeout(t);
    }
  }, [newCount, clearNewCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Package className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  const replyOnWhatsApp = (order: any) => {
    const phone = sanitizePhone(order.buyer_whatsapp || order.buyer_phone);
    if (!phone) return;
    const itemList = (order.order_items || [])
      .map((it: any) => `• ${it.products?.title || 'Item'} (qty ${it.quantity})`)
      .join('\n');
    const msg = `Hello ${order.buyer_name}! 👋\nThank you for your order on P4NO.\n\n${itemList}\n\nHow can I help you?`;
    openWhatsApp(phone, msg);
    if (order.status === 'pending') updateOrderStatus(order.id, 'contacted');
  };

  return (
    <div className="space-y-4">
      {/* New orders banner */}
      <AnimatePresence>
        {newCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-2 flex items-center gap-2"
          >
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">{newCount} new order{newCount > 1 ? 's' : ''} just arrived!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['all', 'pending', 'contacted', 'completed', 'cancelled'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${filter === s ? 'bg-primary text-primary-foreground shadow' : 'bg-muted text-muted-foreground'}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && (
              <span className="ml-1 opacity-70">({orders.filter(o => o.status === s).length})</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>No orders yet</p>
        </div>
      )}

      {filtered.map(order => {
        const waPhone = sanitizePhone(order.buyer_whatsapp || order.buyer_phone);
        return (
          <motion.div
            key={order.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border p-4 space-y-3"
          >
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-semibold text-sm truncate">{order.buyer_name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{order.buyer_phone}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">#{order.id.slice(0, 6).toUpperCase()}</p>
              </div>
              <Badge className={statusStyles[order.status] || statusStyles.pending}>
                {order.status}
              </Badge>
            </div>

            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
            </div>

            <div className="space-y-2">
              {order.order_items?.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 bg-muted/50 rounded-xl p-2">
                  <img src={item.products?.images?.[0] || '/placeholder.svg'} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium line-clamp-1">{item.products?.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Qty: {item.quantity} × {item.products?.currency_symbol || 'Fr'} {new Intl.NumberFormat().format(item.unit_price)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-2">
              {waPhone && (
                <Button
                  size="sm"
                  className="flex-1 min-w-[140px] gap-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={() => replyOnWhatsApp(order)}
                >
                  <MessageCircle className="h-3 w-3" /> Reply on WhatsApp
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-1 rounded-xl"
                onClick={() => {
                  window.open(`tel:${order.buyer_phone}`, '_self');
                  if (order.status === 'pending') updateOrderStatus(order.id, 'contacted');
                }}
              >
                <Phone className="h-3 w-3" /> Call
              </Button>
              {order.status !== 'completed' && order.status !== 'cancelled' && (
                <Button
                  size="sm"
                  className="gap-1 rounded-xl bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => updateOrderStatus(order.id, 'completed')}
                >
                  <CheckCircle2 className="h-3 w-3" /> Complete
                </Button>
              )}
              {order.status !== 'cancelled' && order.status !== 'completed' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  onClick={() => updateOrderStatus(order.id, 'cancelled')}
                >
                  <XCircle className="h-3 w-3" /> Cancel
                </Button>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default SellerOrdersTab;
