import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  buildOrderMessage,
  sanitizePhone,
  openWhatsApp,
  productShareUrl,
  checkCooldown,
  setCooldown,
  type OrderItemForMsg,
} from '@/lib/whatsappOrder';

export interface InstantOrderProduct {
  id: string;
  title: string;
  price: number;
  quantity?: number;
  unlimited_quantity?: boolean | null;
  slug?: string | null;
  currency_symbol?: string | null;
  seller_id: string;
  // Resolved seller WhatsApp (admin override or seller profile)
  seller_whatsapp?: string | null;
  // Resolved display name (shop or seller)
  seller_name?: string | null;
}

export interface PlaceOrderInput {
  product: InstantOrderProduct;
  quantity: number;
  buyerName?: string;
  buyerPhone?: string;
}

const guestKey = 'p4no_guest_buyer';
function readGuest(): { name: string; phone: string } | null {
  try {
    const raw = localStorage.getItem(guestKey);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeGuest(v: { name: string; phone: string }) {
  try { localStorage.setItem(guestKey, JSON.stringify(v)); } catch {}
}

export const useInstantOrder = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const placeOrder = useCallback(async ({ product, quantity, buyerName, buyerPhone }: PlaceOrderInput): Promise<boolean> => {
    // ---- Validation
    const wa = sanitizePhone(product.seller_whatsapp);
    if (!wa) {
      toast({ title: 'Seller has no WhatsApp', description: 'This seller has not configured WhatsApp yet.', variant: 'destructive' });
      return false;
    }
    if (!product.unlimited_quantity && (product.quantity ?? 0) <= 0) {
      toast({ title: 'Out of stock', description: 'This product is no longer available.', variant: 'destructive' });
      return false;
    }
    const cd = checkCooldown([product.id]);
    if (cd.blocked) {
      const mins = Math.ceil((cd.remainingMs ?? 0) / 60000);
      toast({ title: 'Hold on a moment', description: `You just ordered this product. Try again in ~${mins} min.`, });
      return false;
    }

    // ---- Resolve buyer info
    let name = buyerName?.trim() || profile?.full_name?.trim() || '';
    let phone = buyerPhone?.trim() || profile?.call_number?.trim() || profile?.whatsapp_number?.trim() || profile?.phone_number?.trim() || '';
    if (!name || !phone) {
      const guest = readGuest();
      if (guest) { name = name || guest.name; phone = phone || guest.phone; }
    }
    if (!name || !phone) {
      // Inline prompt fallback (very rare; main entry points pre-fill)
      const inputName = window.prompt('Your name (for the seller):');
      if (!inputName) return false;
      const inputPhone = window.prompt('Your phone number:');
      if (!inputPhone) return false;
      name = inputName.trim();
      phone = inputPhone.trim();
      writeGuest({ name, phone });
    } else if (!user) {
      writeGuest({ name, phone });
    }

    setSubmitting(true);
    try {
      // ---- Create order
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          seller_id: product.seller_id,
          buyer_name: name,
          buyer_phone: phone,
          buyer_whatsapp: phone,
          status: 'pending',
        })
        .select('id')
        .single();
      if (orderErr) throw orderErr;

      const { error: itemsErr } = await supabase.from('order_items').insert([{
        order_id: order.id,
        product_id: product.id,
        quantity,
        unit_price: product.price,
      }]);
      if (itemsErr) throw itemsErr;

      // Fire-and-forget seller notification
      supabase.from('notifications').insert({
        user_id: product.seller_id,
        title: 'New Order! 🛒',
        message: `${name} placed an order for "${product.title}" (qty ${quantity}).`,
        type: 'order',
        module: 'orders',
      }).then(() => {});

      setCooldown([product.id]);

      // ---- Build & open WhatsApp
      const msg = buildOrderMessage({
        items: [{
          title: product.title,
          quantity,
          unit_price: product.price,
          currency_symbol: product.currency_symbol,
          url: productShareUrl(product.slug || product.id),
        }],
        buyerName: name,
        orderId: order.id.slice(0, 6).toUpperCase(),
      });
      openWhatsApp(wa, msg);
      return true;
    } catch (err: any) {
      console.error('[useInstantOrder] placeOrder failed:', err);
      toast({ title: 'Could not place order', description: err.message, variant: 'destructive' });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [user, profile, toast]);

  /** Place a multi-product order (cart). All items must share one seller. */
  const placeCartOrder = useCallback(async (params: {
    sellerId: string;
    sellerWhatsapp?: string | null;
    items: Array<{
      id: string;
      title: string;
      price: number;
      quantity: number;
      slug?: string | null;
      currencySymbol?: string | null;
    }>;
    buyerName?: string;
    buyerPhone?: string;
    delivery?: { fee: number; label?: string | null; destination?: string };
  }): Promise<boolean> => {
    const wa = sanitizePhone(params.sellerWhatsapp);
    if (!wa) {
      toast({ title: 'Seller has no WhatsApp', variant: 'destructive' });
      return false;
    }
    if (!params.items.length) return false;

    const cd = checkCooldown(params.items.map(i => i.id));
    if (cd.blocked) {
      const mins = Math.ceil((cd.remainingMs ?? 0) / 60000);
      toast({ title: 'Hold on a moment', description: `Recently ordered. Try again in ~${mins} min.` });
      return false;
    }

    let name = params.buyerName?.trim() || profile?.full_name?.trim() || '';
    let phone = params.buyerPhone?.trim() || profile?.call_number?.trim() || profile?.whatsapp_number?.trim() || profile?.phone_number?.trim() || '';
    if (!name || !phone) {
      const g = readGuest();
      if (g) { name = name || g.name; phone = phone || g.phone; }
    }
    if (!name || !phone) {
      toast({ title: 'Name and phone required', variant: 'destructive' });
      return false;
    }
    if (!user) writeGuest({ name, phone });

    setSubmitting(true);
    try {
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          seller_id: params.sellerId,
          buyer_name: name,
          buyer_phone: phone,
          buyer_whatsapp: phone,
          status: 'pending',
        })
        .select('id')
        .single();
      if (orderErr) throw orderErr;

      const itemsRows = params.items.map(i => ({
        order_id: order.id,
        product_id: i.id,
        quantity: i.quantity,
        unit_price: i.price,
      }));
      const { error: itemsErr } = await supabase.from('order_items').insert(itemsRows);
      if (itemsErr) throw itemsErr;

      supabase.from('notifications').insert({
        user_id: params.sellerId,
        title: 'New Order! 🛒',
        message: `${name} placed an order with ${params.items.length} product(s).`,
        type: 'order',
        module: 'orders',
      }).then(() => {});

      setCooldown(params.items.map(i => i.id));

      const msgItems: OrderItemForMsg[] = params.items.map(i => ({
        title: i.title,
        quantity: i.quantity,
        unit_price: i.price,
        currency_symbol: i.currencySymbol,
        url: productShareUrl(i.slug || i.id),
      }));
      const msg = buildOrderMessage({
        items: msgItems,
        buyerName: name,
        orderId: order.id.slice(0, 6).toUpperCase(),
        delivery: params.delivery,
      });
      openWhatsApp(wa, msg);
      return true;
    } catch (err: any) {
      console.error('[useInstantOrder] placeCartOrder failed:', err);
      toast({ title: 'Could not place order', description: err.message, variant: 'destructive' });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [user, profile, toast]);

  return { placeOrder, placeCartOrder, submitting };
};
