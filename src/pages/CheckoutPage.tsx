import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Minus, Plus, Trash2, ShoppingCart, Loader2, CheckCircle2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useInstantOrder } from "@/hooks/useInstantOrder";

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, clearCart } = useCart();
  const { toast } = useToast();
  const { profile, user } = useAuth();
  const { placeCartOrder, submitting } = useInstantOrder();
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: '', phone: '' });
  const [sellerWa, setSellerWa] = useState<string | null>(null);
  const [sellerLoading, setSellerLoading] = useState(false);

  // Pre-fill buyer info from profile
  useEffect(() => {
    if (profile) {
      setForm(p => ({
        name: p.name || profile.full_name || '',
        phone: p.phone || profile.whatsapp_number || profile.call_number || profile.phone_number || '',
      }));
    } else {
      try {
        const raw = localStorage.getItem('p4no_guest_buyer');
        if (raw) {
          const g = JSON.parse(raw);
          setForm(p => ({ name: p.name || g.name || '', phone: p.phone || g.phone || '' }));
        }
      } catch {}
    }
  }, [profile]);

  // Resolve seller WhatsApp once we know the seller
  useEffect(() => {
    const sellerId = items[0]?.sellerId;
    if (!sellerId) { setSellerWa(null); return; }
    setSellerLoading(true);
    (async () => {
      try {
        const { data } = await supabase.from('profiles').select('whatsapp_number,call_number').eq('id', sellerId).maybeSingle();
        setSellerWa(data?.whatsapp_number || data?.call_number || null);
      } finally {
        setSellerLoading(false);
      }
    })();
  }, [items[0]?.sellerId]);

  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleQuantityChange = (id: string, delta: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const err = updateQuantity(id, item.quantity + delta);
    if (err) setErrors(prev => ({ ...prev, [id]: err }));
    else setErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: "Name and phone are required", variant: "destructive" });
      return;
    }
    if (items.length === 0) return;
    const sellerId = items[0].sellerId;

    const ok = await placeCartOrder({
      sellerId,
      sellerWhatsapp: sellerWa,
      items: items.map(i => ({
        id: i.id,
        title: i.title,
        price: i.price,
        quantity: i.quantity,
        currencySymbol: i.currencySymbol,
      })),
      buyerName: form.name.trim(),
      buyerPhone: form.phone.trim(),
    });
    if (ok) {
      setSuccess(true);
      clearCart();
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-card rounded-3xl p-8 border shadow-xl">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Order Sent! 🎉</h2>
          <p className="text-muted-foreground mb-6">We've opened WhatsApp with your order. Continue the chat with the seller there.</p>
          <Button onClick={() => navigate('/')} className="gap-2 rounded-xl">Continue Shopping</Button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <ShoppingCart className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Your order is empty</h2>
          <p className="text-muted-foreground mb-4">Mark products to add them here</p>
          <Button onClick={() => navigate('/')} className="rounded-xl">Browse Products</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b">
        <div className="flex items-center gap-3 h-14 px-4">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-bold text-lg">Checkout</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <div className="bg-primary/5 rounded-2xl p-3 border border-primary/10">
          <p className="text-sm font-medium text-primary">
            Ordering from: <span className="font-bold">{items[0].sellerName}</span>
          </p>
          {!sellerLoading && !sellerWa && (
            <p className="text-xs text-destructive mt-1">⚠️ This seller has no WhatsApp configured.</p>
          )}
        </div>

        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-card rounded-2xl border p-3">
              <div className="flex gap-3">
                <img src={item.image || '/placeholder.svg'} alt={item.title} className="w-20 h-20 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm line-clamp-2">{item.title}</h3>
                  <p className="text-primary font-bold text-sm mt-1">
                    {item.currencySymbol || 'Fr'} {new Intl.NumberFormat().format(item.price)}
                  </p>
                </div>
                <button onClick={() => removeItem(item.id)} className="text-destructive self-start">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Quantity</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleQuantityChange(item.id, -1)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-10 text-center font-semibold text-sm">{item.quantity}</span>
                  <button onClick={() => handleQuantityChange(item.id, 1)} className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
              {errors[item.id] && <p className="text-xs text-destructive mt-1">{errors[item.id]}</p>}
            </div>
          ))}
        </div>

        <div className="bg-card rounded-2xl border p-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold text-primary">
              {items[0]?.currencySymbol || 'Fr'} {new Intl.NumberFormat().format(totalPrice)}
            </span>
          </div>
        </div>

        <div className="bg-card rounded-2xl border p-4 space-y-4">
          <h3 className="font-semibold">Your Contact Info</h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" placeholder="Your full name" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="rounded-xl mt-1" />
            </div>
            <div>
              <Label htmlFor="phone">WhatsApp / Phone *</Label>
              <Input id="phone" placeholder="07x xxx xxxx" value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="rounded-xl mt-1" />
            </div>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitting || !form.name.trim() || !form.phone.trim() || !sellerWa}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-lg font-bold gap-2 shadow-xl text-white"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-5 w-5" />}
          {submitting ? 'Sending...' : 'Send Order via WhatsApp'}
        </Button>
      </div>
    </div>
  );
};

export default CheckoutPage;
