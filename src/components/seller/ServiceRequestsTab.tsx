import { MessageCircle, Phone, Check, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useServiceRequests } from '@/hooks/useServiceRequests';
import { sanitizePhone } from '@/lib/whatsappService';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  contacted: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  cancelled: 'bg-muted text-muted-foreground',
};

const ServiceRequestsTab = () => {
  const { requests, loading, updateStatus } = useServiceRequests();

  const reply = (phone: string | null, name: string, title: string) => {
    const p = sanitizePhone(phone);
    if (!p) return;
    const msg = encodeURIComponent(`Hi ${name}! Thanks for requesting "${title}" on P4NO Connect. How can I help?`);
    window.open(`https://wa.me/${p}?text=${msg}`, '_blank');
  };

  if (loading) return <div className="text-center py-8 text-sm text-muted-foreground">Loading requests…</div>;
  if (requests.length === 0) return (
    <div className="text-center py-12 bg-card rounded-2xl border">
      <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
      <p className="text-sm text-muted-foreground">No service requests yet.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {requests.map((r: any) => (
        <div key={r.id} className="bg-card rounded-2xl p-3 border space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{r.services?.title || 'Service'}</p>
              <p className="text-xs text-muted-foreground">From {r.buyer_name}</p>
            </div>
            <Badge className={STATUS_COLORS[r.status] || ''}>{r.status}</Badge>
          </div>
          {r.message && <p className="text-sm bg-muted/40 p-2 rounded-lg">{r.message}</p>}
          {r.buyer_location && <p className="text-xs text-muted-foreground">📍 {r.buyer_location}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            {r.buyer_phone && (
              <>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => reply(r.buyer_phone, r.buyer_name, r.services?.title || '')}>
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => window.open(`tel:${r.buyer_phone}`, '_self')}>
                  <Phone className="h-3 w-3" /> Call
                </Button>
              </>
            )}
            {r.status !== 'contacted' && r.status !== 'completed' && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => updateStatus(r.id, 'contacted')}>Mark contacted</Button>
            )}
            {r.status !== 'completed' && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-emerald-600 border-emerald-300" onClick={() => updateStatus(r.id, 'completed')}>
                <Check className="h-3 w-3" /> Done
              </Button>
            )}
            {r.status !== 'cancelled' && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-destructive border-destructive/30" onClick={() => updateStatus(r.id, 'cancelled')}>
                <X className="h-3 w-3" /> Cancel
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ServiceRequestsTab;
