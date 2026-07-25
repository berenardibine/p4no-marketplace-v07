import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, Star, Pause, Play, Trash2, Eye, Search, Loader2, ShieldAlert, Edit2, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

type StatusFilter = 'all' | 'active' | 'paused' | 'suspended' | 'featured';

const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'featured', label: 'Featured' },
];

const AdminServices = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('services')
      .select('*, seller:profiles!services_seller_id_fkey(id, full_name, profile_image, identity_verified)')
      .order('created_at', { ascending: false })
      .limit(500);

    if (filter === 'featured') q = q.eq('is_featured', true);
    else if (filter !== 'all') q = q.eq('status', filter);

    let { data, error } = await q;
    if (error && /relationship/i.test(error.message)) {
      const fb = await supabase.from('services').select('*').order('created_at', { ascending: false }).limit(500);
      data = fb.data as any;
    }
    setServices(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('services').update({ status }).eq('id', id);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: `Service ${status}` });
    load();
  };

  const toggleFeature = async (s: any) => {
    const { error } = await supabase.from('services').update({ is_featured: !s.is_featured }).eq('id', s.id);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: s.is_featured ? 'Removed from featured' : '⭐ Featured' });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Permanently delete this service?')) return;
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Service deleted' });
    load();
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from('services')
      .update({
        title: editing.title,
        short_description: editing.short_description,
        description: editing.description,
        price: editing.price,
        location: editing.location,
        whatsapp_number: editing.whatsapp_number,
        phone_number: editing.phone_number,
      })
      .eq('id', editing.id);
    setSaving(false);
    if (error) return toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Service updated' });
    setEditing(null);
    load();
  };

  const filtered = services.filter(s =>
    !search || s.title?.toLowerCase().includes(search.toLowerCase()) || s.seller?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (adminLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!isAdmin) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center"><ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-2" /><p>Admin access required</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 pb-12">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b">
        <div className="flex items-center gap-3 h-14 px-4">
          <button onClick={() => navigate('/admin')} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Briefcase className="h-5 w-5 text-primary" />
            <h1 className="font-bold">P4NO Connect • Services</h1>
          </div>
          <Badge variant="secondary">{filtered.length}</Badge>
        </div>
      </header>

      <main className="container px-4 py-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title or provider…" className="pl-9 rounded-xl" />
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => setFilter(s.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filter === s.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'
              }`}
            >{s.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-card border rounded-2xl">
            <Briefcase className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No services found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(s => (
              <div key={s.id} className="bg-card rounded-2xl p-3 border">
                <div className="flex gap-3">
                  <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden shrink-0">
                    <img src={s.video_thumbnail || s.images?.[0] || '/placeholder.svg'} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <h3 className="font-semibold text-sm flex-1 line-clamp-2">{s.title}</h3>
                      {s.is_featured && <Star className="h-4 w-4 text-amber-500 shrink-0" fill="currentColor" />}
                      <Badge variant={s.status === 'active' ? 'default' : s.status === 'suspended' ? 'destructive' : 'secondary'} className="text-[10px] shrink-0">
                        {s.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      by {s.seller?.full_name || 'Unknown'} · {s.currency_symbol || ''}{Number(s.price || 0).toLocaleString()}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => navigate(`/connect/service/${s.slug || s.id}`)}>
                        <Eye className="h-3 w-3" /> View
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setEditing({ ...s })}>
                        <Edit2 className="h-3 w-3" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => toggleFeature(s)}>
                        <Star className="h-3 w-3" /> {s.is_featured ? 'Unfeature' : 'Feature'}
                      </Button>
                      {s.status === 'active' ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setStatus(s.id, 'paused')}>
                          <Pause className="h-3 w-3" /> Pause
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setStatus(s.id, 'active')}>
                          <Play className="h-3 w-3" /> Activate
                        </Button>
                      )}
                      {s.status !== 'suspended' ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30" onClick={() => setStatus(s.id, 'suspended')}>
                          <ShieldAlert className="h-3 w-3" /> Suspend
                        </Button>
                      ) : null}
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30" onClick={() => remove(s.id)}>
                        <Trash2 className="h-3 w-3" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Service</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><label className="text-xs font-medium">Title</label>
                <Input value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} /></div>
              <div><label className="text-xs font-medium">Short description</label>
                <Input value={editing.short_description || ''} onChange={e => setEditing({ ...editing, short_description: e.target.value })} /></div>
              <div><label className="text-xs font-medium">Description</label>
                <Textarea rows={4} value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs font-medium">Price</label>
                  <Input type="number" value={editing.price ?? ''} onChange={e => setEditing({ ...editing, price: e.target.value ? Number(e.target.value) : null })} /></div>
                <div><label className="text-xs font-medium">Location</label>
                  <Input value={editing.location || ''} onChange={e => setEditing({ ...editing, location: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs font-medium">WhatsApp</label>
                  <Input value={editing.whatsapp_number || ''} onChange={e => setEditing({ ...editing, whatsapp_number: e.target.value })} /></div>
                <div><label className="text-xs font-medium">Phone</label>
                  <Input value={editing.phone_number || ''} onChange={e => setEditing({ ...editing, phone_number: e.target.value })} /></div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} className="gap-1"><X className="h-4 w-4" />Cancel</Button>
            <Button onClick={saveEdit} disabled={saving} className="gap-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminServices;
