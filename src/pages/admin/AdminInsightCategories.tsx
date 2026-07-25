import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const AdminInsightCategories = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [newCat, setNewCat] = useState({ name: '', slug: '', description: '', icon: '' });

  const load = async () => {
    const { data } = await (supabase as any).from('insight_categories').select('*').order('sort_order');
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newCat.name.trim()) return;
    await (supabase as any).from('insight_categories').insert({
      name: newCat.name.trim(),
      slug: newCat.slug.trim() || slugify(newCat.name),
      description: newCat.description || null,
      icon: newCat.icon || null,
      sort_order: rows.length,
    });
    setNewCat({ name: '', slug: '', description: '', icon: '' });
    toast({ title: 'Category created' }); load();
  };

  const update = async (id: string, patch: any) => {
    await (supabase as any).from('insight_categories').update(patch).eq('id', id);
    toast({ title: 'Saved' }); load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    await (supabase as any).from('insight_categories').delete().eq('id', id);
    load();
  };

  return (
    <div className="min-h-screen bg-background p-6 max-w-4xl mx-auto">
      <button onClick={() => navigate('/admin/insights')} className="text-sm text-muted-foreground mb-4 inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to articles
      </button>
      <h1 className="text-2xl font-bold mb-6">Insight categories</h1>

      <div className="rounded-xl border border-border bg-card p-4 mb-6 space-y-3">
        <h2 className="font-bold text-sm">New category</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <Input placeholder="Name" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
          <Input placeholder="slug (optional)" value={newCat.slug} onChange={(e) => setNewCat({ ...newCat, slug: e.target.value })} />
          <Input placeholder="icon emoji" value={newCat.icon} onChange={(e) => setNewCat({ ...newCat, icon: e.target.value })} />
          <Button onClick={create} className="gap-1.5"><Plus className="h-4 w-4" />Add</Button>
        </div>
        <Textarea placeholder="Description" value={newCat.description} onChange={(e) => setNewCat({ ...newCat, description: e.target.value })} rows={2} />
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <CategoryRow key={r.id} row={r} onSave={(p) => update(r.id, p)} onDelete={() => remove(r.id)} />
        ))}
      </div>
    </div>
  );
};

const CategoryRow = ({ row, onSave, onDelete }: any) => {
  const [f, setF] = useState(row);
  return (
    <div className="rounded-xl border border-border bg-card p-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_80px_80px_auto] gap-2 items-center">
      <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />
      <Input value={f.icon || ''} placeholder="icon" onChange={(e) => setF({ ...f, icon: e.target.value })} />
      <Input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: parseInt(e.target.value, 10) || 0 })} />
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onSave({ name: f.name, slug: f.slug, icon: f.icon, sort_order: f.sort_order, is_active: f.is_active })}><Save className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  );
};

export default AdminInsightCategories;