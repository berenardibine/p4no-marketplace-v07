// WhatsApp service request message builder & helpers for P4NO Connect.
import { sanitizePhone, openWhatsApp } from './whatsappOrder';

export { sanitizePhone, openWhatsApp };

export interface ServiceRequestMsgInput {
  serviceTitle: string;
  serviceUrl: string;
  buyerName?: string;
  buyerLocation?: string;
  message?: string;
  requestId?: string;
}

export function buildServiceRequestMessage(input: ServiceRequestMsgInput): string {
  const { serviceTitle, serviceUrl, buyerName, buyerLocation, message, requestId } = input;
  const greeting = buyerName
    ? `Hello! I'm ${buyerName} from P4NO Connect 👋`
    : `Hello! I'd like to request a service via P4NO Connect 👋`;
  const lines = [
    greeting,
    '',
    `🛠️ Service: ${serviceTitle}`,
    `🔗 ${serviceUrl}`,
  ];
  if (buyerLocation) lines.push(`📍 Location: ${buyerLocation}`);
  if (message?.trim()) lines.push('', `💬 ${message.trim()}`);
  if (requestId) lines.push('', `Request #${requestId}`);
  lines.push('', 'Could you share availability and pricing? Thank you!');
  return lines.join('\n');
}

export function serviceShareUrl(slugOrId: string): string {
  return `${window.location.origin}/connect/service/${slugOrId}`;
}

const COOLDOWN_KEY = 'p4no_service_request_cooldown';
const COOLDOWN_MS = 10 * 60 * 1000;

export function checkServiceCooldown(serviceId: string): { blocked: boolean; remainingMs?: number } {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    const t = map[serviceId];
    if (t && Date.now() - t < COOLDOWN_MS) {
      return { blocked: true, remainingMs: COOLDOWN_MS - (Date.now() - t) };
    }
  } catch {}
  return { blocked: false };
}

export function setServiceCooldown(serviceId: string) {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    map[serviceId] = now;
    for (const k of Object.keys(map)) {
      if (now - map[k] > COOLDOWN_MS) delete map[k];
    }
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify(map));
  } catch {}
}
