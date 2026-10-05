// WhatsApp order message builder & helpers — used by all "Order Now" entry points.

export interface OrderItemForMsg {
  title: string;
  quantity: number;
  unit_price: number;
  currency_symbol?: string | null;
  url: string;
}

export interface BuildMessageInput {
  items: OrderItemForMsg[];
  buyerName?: string;
  orderId?: string; // short id (last 6 chars)
  delivery?: { fee: number; label?: string | null; destination?: string };
}

const fmt = (n: number) => new Intl.NumberFormat().format(n);

export function buildOrderMessage({ items, buyerName, orderId, delivery }: BuildMessageInput): string {
  if (!items.length) return '';
  const greeting = buyerName
    ? `Hello! I'm ${buyerName} from P4NO 👋`
    : `Hello! I'm interested in ordering from P4NO 👋`;

  const sym = items[0].currency_symbol || '';
  const subTotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const grandTotal = subTotal + (delivery?.fee || 0);
  const deliveryLine = delivery
    ? `🚚 Delivery${delivery.destination ? ` (${delivery.destination})` : ''}: ${delivery.label || `${sym} ${fmt(delivery.fee)}`}`
    : '';

  if (items.length === 1) {
    const it = items[0];
    return [
      greeting,
      '',
      `📦 ${it.title}`,
      `🔢 Qty: ${it.quantity}`,
      `💰 ${sym} ${fmt(it.unit_price)} (Subtotal: ${sym} ${fmt(subTotal)})`,
      deliveryLine,
      delivery ? `💰 Total: ${sym} ${fmt(grandTotal)}` : '',
      `🔗 ${it.url}`,
      orderId ? `\nOrder #${orderId}` : '',
      'Please share more details. Thank you!',
    ].filter(Boolean).join('\n');
  }

  const lines = [greeting, '', `I'd like to order ${items.length} products:`, ''];
  items.forEach((it, idx) => {
    const subtotal = it.unit_price * it.quantity;
    lines.push(
      `${idx + 1}. ${it.title}`,
      `   Qty: ${it.quantity} × ${it.currency_symbol || ''} ${fmt(it.unit_price)} = ${it.currency_symbol || ''} ${fmt(subtotal)}`,
      `   ${it.url}`,
      ''
    );
  });
  if (delivery) lines.push(`Subtotal: ${sym} ${fmt(subTotal)}`, deliveryLine);
  lines.push(`💰 Grand total: ${sym} ${fmt(grandTotal)}`);
  if (orderId) lines.push(`Order #${orderId}`);
  lines.push('Please share more details. Thank you!');
  return lines.join('\n');
}

export function sanitizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length < 7) return null;
  return digits;
}

export function openWhatsApp(phone: string, message: string) {
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  // Open in same window on mobile for smoother handoff to WhatsApp app
  window.open(url, '_blank', 'noopener');
}

export function productShareUrl(slugOrId: string): string {
  return `${window.location.origin}/p/${slugOrId}`;
}

const COOLDOWN_KEY = 'p4no_order_cooldown';
const COOLDOWN_MS = 10 * 60 * 1000; // 10 min

export function checkCooldown(productIds: string[]): { blocked: boolean; remainingMs?: number } {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    for (const pid of productIds) {
      const t = map[pid];
      if (t && now - t < COOLDOWN_MS) {
        return { blocked: true, remainingMs: COOLDOWN_MS - (now - t) };
      }
    }
  } catch {}
  return { blocked: false };
}

export function setCooldown(productIds: string[]) {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    for (const pid of productIds) map[pid] = now;
    // prune stale entries
    for (const k of Object.keys(map)) {
      if (now - map[k] > COOLDOWN_MS) delete map[k];
    }
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify(map));
  } catch {}
}
