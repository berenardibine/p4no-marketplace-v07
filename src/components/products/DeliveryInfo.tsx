import { useEffect, useMemo, useState } from 'react';
import { Truck, Plus, Trash2 } from 'lucide-react';
import { useGeo } from '@/context/GeoContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

export interface DeliveryRule {
  country: string;
  location?: string;
  fee?: number | null;
  currency?: string;
  free?: boolean;
  contact?: boolean;
}

const norm = (s?: string) => (s || '').trim().toLowerCase();

/** Public display: reads rules already in the static product JSON — no extra requests. */
export function ProductDeliveryInfo({ rules }: { rules?: DeliveryRule[] | null }) {
  const { country: detected, countries } = useGeo();
  const [dest, setDest] = useState<string>('');
  useEffect(() => { if (!dest && detected) setDest(detected); }, [detected, dest]);

  const list = Array.isArray(rules) ? rules.filter(r => r?.country) : [];
  const options = useMemo(() => {
    const names = new Set<string>(list.map(r => r.country));
    countries.forEach(c => names.add(c.name));
    if (detected) names.add(detected);
    return Array.from(names).sort();
  }, [list, countries, detected]);

  const matches = list.filter(r => norm(r.country) === norm(dest));
  const fmt = (r: DeliveryRule) =>
    r.contact ? 'Contact seller'
    : r.free ? 'Free delivery'
    : r.fee != null ? `${r.currency || ''} ${Number(r.fee).toLocaleString('en-US')}`.trim()
    : 'Contact seller';

  return (
    <div className="bg-muted/50 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Deliver to</h3>
        <select
          aria-label="Delivery destination country"
          value={dest}
          onChange={e => setDest(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
        >
          {!dest && <option value="">Select country</option>}
          {options.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      {matches.length > 0 ? (
        <ul className="space-y-1.5">
          {matches.map((r, i) => (
            <li key={i} className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{r.location || 'All locations'}</span>
              <span className={r.free ? 'font-semibold text-primary' : 'font-medium'}>{fmt(r)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Delivery to this location: <span className="font-medium text-foreground">Contact seller</span></p>
      )}
    </div>
  );
}

/** Seller editor for multiple delivery rules. */
export function DeliveryRulesEditor({ value, onChange, defaultCurrency }: {
  value: DeliveryRule[]; onChange: (v: DeliveryRule[]) => void; defaultCurrency?: string;
}) {
  const update = (i: number, patch: Partial<DeliveryRule>) =>
    onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-3">
      <Label>Delivery options</Label>
      {value.map((r, i) => (
        <div key={i} className="rounded-xl border border-border p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Country (e.g. Rwanda)" value={r.country} onChange={e => update(i, { country: e.target.value })} />
            <Input placeholder="City/Region (optional)" value={r.location || ''} onChange={e => update(i, { location: e.target.value })} />
            <Input type="number" min={0} placeholder="Delivery fee" disabled={r.free || r.contact}
              value={r.fee ?? ''} onChange={e => update(i, { fee: e.target.value === '' ? null : Number(e.target.value) })} />
            <Input placeholder="Currency (e.g. RWF)" value={r.currency || ''} onChange={e => update(i, { currency: e.target.value.toUpperCase() })} />
          </div>
          <div className="flex items-center gap-4 flex-wrap text-sm">
            <label className="flex items-center gap-2"><Switch checked={!!r.free} onCheckedChange={v => update(i, { free: v, contact: v ? false : r.contact })} /> Free</label>
            <label className="flex items-center gap-2"><Switch checked={!!r.contact} onCheckedChange={v => update(i, { contact: v, free: v ? false : r.free })} /> Contact seller</label>
            <Button type="button" variant="ghost" size="sm" className="ml-auto text-destructive" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { country: '', currency: defaultCurrency || '' }])}>
        <Plus className="h-4 w-4 mr-1" /> Add delivery rule
      </Button>
    </div>
  );
}
