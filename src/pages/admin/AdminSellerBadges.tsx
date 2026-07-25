import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Award, Search, Plus, Pencil, Trash2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import SellerAchievementsCard from '@/components/badges/SellerAchievementsCard';

const TIERS = ['bronze', 'silver', 'gold', 'platinum'];
const REQUIREMENT_TYPES = ['verified', 'first_product', 'products', 'orders', 'answers', 'articles', 'reviews', 'streak', 'profile_views'];

interface BadgeDef {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  category: string;
  requirements: any;
  is_active: boolean;
  display_order: number;
}

const emptyDef: BadgeDef = {
  code: '', name: '', description: '', icon: 'Award',
  tier: 'bronze', category: 'general',
  requirements: { type: 'orders', min: 1 },
  is_active: true, display_order: 0,
};

const AdminSellerBadges = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [defs, setDefs] = useState<BadgeDef[]>([]);
  const [defLoading, setDefLoading] = useState(true);
  const [editing, setEditing] = useState<BadgeDef | null>(null);
  const [creating, setCreating] = useState(false);

  const [sellers, setSellers] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const fetchDefs = async () => {
    setDefLoading(true);
    const { data } = await supabase.from('badge_definitions').select('*').order('display_order');
    setDefs((data as any) || []);
    setDefLoading(false);
  };

  useEffect(() => {
    fetchDefs();
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, profile_image, user_type')
        .eq('user_type', 'seller')
        .limit(100);
      setSellers((data as any) || []);
    })();
  }, []);

  const filtered = sellers.filter(s => (s.full_name || '').toLowerCase().includes(query.toLowerCase()));

  const openCreate = () => { setEditing({ ...emptyDef }); setCreating(true); };
  const openEdit = (d: BadgeDef) => { setEditing({ ...d }); setCreating(false); };

  const save = async () => {
    if (!editing) return;
    if (!editing.code || !editing.name) { toast({ title: 'Code and name are required', variant: 'destructive' }); return; }
    const payload = { ...editing };
    let error: any;
    if (creating) {
      ({ error } = await supabase.from('badge_definitions').insert(payload as any));
    } else {
      ({ error } = await supabase.from('badge_definitions').update(payload as any).eq('code', editing.code));
    }
    if (error) { toast({ title: 'Failed to save', description: error.message, variant: 'destructive' }); return; }
    toast({ title: creating ? 'Badge created' : 'Badge updated' });
    setEditing(null); setCreating(false); fetchDefs();
  };

  const remove = async (code: string) => {
    if (!confirm('Delete this badge? Users who earned it will lose it.')) return;
    const { error } = await supabase.from('badge_definitions').delete().eq('code', code);
    if (error) { toast({ title: 'Failed to delete', variant: 'destructive' }); return; }
    toast({ title: 'Badge deleted' });
    fetchDefs();
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b">
        <div className="flex items-center gap-3 h-14 px-4">
          <button onClick={() => navigate('/admin')} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center"><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex items-center gap-2 flex-1">
            <Award className="h-5 w-5 text-primary" />
            <h1 className="font-bold text-base">Badges Manager</h1>
          </div>
        </div>
      </header>

      <main className="container px-4 py-4">
        <Tabs defaultValue="definitions">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="definitions">Badges</TabsTrigger>
            <TabsTrigger value="sellers">Seller Progress</TabsTrigger>
          </TabsList>

          <TabsContent value="definitions" className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{defs.length} badge definitions</p>
              <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> New Badge</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {defLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!defLoading && defs.length === 0 && <p className="text-sm text-muted-foreground">No badges yet.</p>}
              {defs.map(d => (
                <div key={d.code} className="bg-card border rounded-2xl p-3 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold capitalize text-xs">{d.tier[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-sm">{d.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted capitalize">{d.tier}</span>
                      {!d.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">inactive</span>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{d.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Code: <code>{d.code}</code> · Req: {JSON.stringify(d.requirements)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(d.code)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sellers">
            <div className="grid grid-cols-1 lg:grid-cols-[300px,1fr] gap-4">
              <aside className="space-y-3">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sellers…" className="pl-9" />
                </div>
                <div className="space-y-1 max-h-[70vh] overflow-y-auto">
                  {filtered.map(s => (
                    <button
                      key={s.id || s.user_id}
                      onClick={() => setSelected(s.id || s.user_id)}
                      className={`w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-muted ${selected === (s.id || s.user_id) ? 'bg-muted ring-1 ring-primary/30' : ''}`}
                    >
                      <div className="w-9 h-9 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                        {s.profile_image ? <img src={s.profile_image} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold">{(s.full_name || '?')[0]}</span>}
                      </div>
                      <span className="text-sm truncate">{s.full_name || 'Unnamed'}</span>
                    </button>
                  ))}
                  {filtered.length === 0 && <p className="text-xs text-muted-foreground p-3">No sellers.</p>}
                </div>
              </aside>
              <section>
                {selected ? (
                  <SellerAchievementsCard userId={selected} />
                ) : (
                  <div className="bg-card border rounded-2xl p-8 text-center text-sm text-muted-foreground">
                    Select a seller to view earned badges and progress toward the next ones.
                  </div>
                )}
              </section>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Editor Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && (setEditing(null), setCreating(false))}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{creating ? 'New Badge' : 'Edit Badge'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Code</Label>
                  <Input value={editing.code} disabled={!creating} onChange={(e) => setEditing({ ...editing, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })} placeholder="e.g. first_sale" />
                </div>
                <div>
                  <Label>Name</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Icon (lucide)</Label>
                  <Input value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} placeholder="Award" />
                </div>
                <div>
                  <Label>Tier</Label>
                  <Select value={editing.tier} onValueChange={(v) => setEditing({ ...editing, tier: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIERS.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2 p-3 border rounded-xl bg-muted/30">
                <Label className="text-xs uppercase text-muted-foreground">Earning condition</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={editing.requirements?.type || 'orders'}
                      onValueChange={(v) => setEditing({ ...editing, requirements: { ...(editing.requirements || {}), type: v } })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REQUIREMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Threshold (min / days)</Label>
                    <Input
                      type="number"
                      value={editing.requirements?.min ?? editing.requirements?.days ?? 1}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        const key = editing.requirements?.type === 'streak' ? 'days' : 'min';
                        setEditing({ ...editing, requirements: { ...(editing.requirements || {}), [key]: n } });
                      }}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  System checks this requirement against the seller's stats (products, orders, reviews, etc.) and grants the badge automatically when met.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <Label>Display order</Label>
                  <Input type="number" value={editing.display_order} onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })} />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-xl">
                  <Label className="text-sm">Active</Label>
                  <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setCreating(false); }}>Cancel</Button>
            <Button onClick={save} className="gap-1.5"><Save className="h-4 w-4" /> Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSellerBadges;