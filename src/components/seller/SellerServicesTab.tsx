import { useState } from 'react';
import { Plus, Edit2, Pause, Play, Trash2, Eye, AlertTriangle, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSellerServices } from '@/hooks/useSellerServices';
import { useAdminSettings } from '@/hooks/useAdminSettings';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import ServiceForm from './ServiceForm';
import { useNavigate } from 'react-router-dom';

const SellerServicesTab = () => {
  const { profile } = useAuth();
  const { services, loading, refetch, updateStatus, remove } = useSellerServices();
  const { getSetting } = useAdminSettings();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const requireVerification = getSetting('services_require_verification', false);
  const isVerified = (profile as any)?.identity_verified === true;
  const canPost = !requireVerification || isVerified;

  if (showForm || editing) {
    return (
      <ServiceForm
        service={editing}
        onSuccess={() => { setShowForm(false); setEditing(null); refetch(); toast({ title: editing ? 'Service updated' : 'Service published 🎉' }); }}
        onCancel={() => { setShowForm(false); setEditing(null); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {requireVerification && !isVerified && (
        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Identity verification required</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Verify your identity to publish services on P4NO Connect.</p>
          </div>
        </div>
      )}

      <Button
        onClick={() => {
          if (!canPost) { toast({ title: 'Verify your identity first', variant: 'destructive' }); return; }
          setShowForm(true);
        }}
        className="w-full gap-2 rounded-xl h-12 bg-gradient-to-r from-primary to-primary/80"
        disabled={!canPost}
      >
        <Plus className="h-4 w-4" /> Add New Service
      </Button>

      {loading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Loading services…</div>
      ) : services.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border">
          <Briefcase className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold mb-2">No services yet</h3>
          <p className="text-muted-foreground text-sm">Publish your first service to start receiving requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((s: any) => (
            <div key={s.id} className="bg-card rounded-2xl p-3 border flex gap-3">
              <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden shrink-0">
                <img src={s.video_thumbnail || s.images?.[0] || '/placeholder.svg'} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm line-clamp-2">{s.title}</h3>
                  <Badge variant={s.status === 'active' ? 'default' : 'secondary'} className="text-[10px] shrink-0">{s.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {s.currency_symbol} {Number(s.price || 0).toLocaleString()} · {s.pricing_type}
                </p>
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => navigate(`/connect/service/${s.slug || s.id}`)}>
                    <Eye className="h-3 w-3" /> View
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setEditing(s)}>
                    <Edit2 className="h-3 w-3" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => updateStatus(s.id, s.status === 'active' ? 'paused' : 'active')}>
                    {s.status === 'active' ? <><Pause className="h-3 w-3" />Pause</> : <><Play className="h-3 w-3" />Resume</>}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30"
                    onClick={() => { if (confirm('Delete this service?')) remove(s.id); }}>
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SellerServicesTab;
