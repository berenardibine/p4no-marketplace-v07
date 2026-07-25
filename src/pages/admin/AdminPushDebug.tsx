import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { toast } from 'sonner';

interface Sub {
  id: string;
  user_id: string | null;
  browser: string | null;
  device_type: string | null;
  is_active: boolean;
  last_active_at: string;
}
interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface QueueStats {
  pending: number;
  sent: number;
  delivered: number;
  clicked: number;
  failed: number;
  grouped: number;
  offline_queue: number; // pending older than 5 min
  delivered_24h: number;
  failed_24h: number;
}

export default function AdminPushDebug() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<any>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [advStats, setAdvStats] = useState<any | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadQueueStats = async () => {
    const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const statuses = ['pending', 'sent', 'delivered', 'clicked', 'failed', 'grouped'] as const;
    const counts: any = {};
    await Promise.all(
      statuses.map(async (s) => {
        const { count } = await supabase
          .from('notification_queue')
          .select('id', { count: 'exact', head: true })
          .eq('status', s);
        counts[s] = count || 0;
      })
    );
    const { count: offlineQ } = await supabase
      .from('notification_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('created_at', fiveMinAgo);
    const { count: delivered24 } = await supabase
      .from('notification_events')
      .select('id', { count: 'exact', head: true })
      .eq('event', 'delivered')
      .gte('created_at', sinceDay);
    const { count: failed24 } = await supabase
      .from('notification_events')
      .select('id', { count: 'exact', head: true })
      .eq('event', 'failed')
      .gte('created_at', sinceDay);
    setQueueStats({
      ...counts,
      offline_queue: offlineQ || 0,
      delivered_24h: delivered24 || 0,
      failed_24h: failed24 || 0,
    });
  };

  const loadAdvancedStats = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('notification-stats', { body: {} });
      if (error) throw error;
      setAdvStats(data);
    } catch (e) {
      // silent; card simply hides
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      const [{ data: subData }, { data: userData }] = await Promise.all([
        supabase.from('push_subscriptions').select('id,user_id,browser,device_type,is_active,last_active_at').limit(1000),
        supabase.from('profiles').select('id, full_name, email').limit(500),
        loadQueueStats(),
        loadAdvancedStats(),
      ]);
      setSubs((subData as Sub[]) || []);
      setUsers((userData as UserRow[]) || []);
      setLoading(false);
    })();
  }, [isAdmin]);

  const runFn = async (name: string, label: string) => {
    setBusy(name);
    try {
      const { error } = await supabase.functions.invoke(name, { body: {} });
      if (error) throw error;
      toast.success(`${label} done`);
      await loadQueueStats();
    } catch (e: any) {
      toast.error(e?.message || `${label} failed`);
    } finally {
      setBusy(null);
    }
  };

  const reprocessFailed = async () => {
    setBusy('reprocess');
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('notification_queue')
        .update({ status: 'pending', attempts: 0, next_attempt_at: new Date().toISOString() })
        .eq('status', 'failed')
        .gt('created_at', oneHourAgo);
      if (error) throw error;
      toast.success('Failed jobs requeued');
      await loadQueueStats();
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusy(null);
    }
  };


  const stats = useMemo(() => {
    const total = subs.length;
    const active = subs.filter((s) => s.is_active).length;
    const disabled = total - active;
    const byBrowser: Record<string, number> = {};
    const byDevice: Record<string, number> = {};
    subs.forEach((s) => {
      const b = s.browser || 'unknown';
      const d = s.device_type || 'unknown';
      byBrowser[b] = (byBrowser[b] || 0) + 1;
      byDevice[d] = (byDevice[d] || 0) + 1;
    });
    return { total, active, disabled, byBrowser, byDevice };
  }, [subs]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users.slice(0, 50);
    return users
      .filter((u) =>
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [users, search]);

  const sendTest = async () => {
    if (!selectedUser) {
      toast.error('Select a user first');
      return;
    }
    setSending(true);
    setLastError(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: { mode: 'test', target_user_id: selectedUser },
      });
      // FunctionsHttpError exposes .context with the response body
      if (error) {
        let detail: any = { message: error.message };
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) detail = await ctx.json();
          else if (ctx?.text) detail.body = await ctx.text();
        } catch {}
        setLastError(detail);
        toast.error(detail?.error || detail?.detail || detail.message || 'Failed');
        return;
      }
      const sent = (data as any)?.sent ?? 0;
      const failed = (data as any)?.failed ?? 0;
      if ((data as any)?.error) {
        setLastError(data);
        toast.error((data as any).error);
        return;
      }
      if (sent > 0) toast.success(`Sent to ${sent} device${sent > 1 ? 's' : ''}`);
      else toast.error(`No delivery (failed: ${failed})`);
    } catch (err: any) {
      setLastError({ message: err?.message });
      toast.error(err?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) { navigate('/'); return null; }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate('/admin')}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-semibold text-lg">Push Debug Center</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-3xl mx-auto">
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Subscriptions</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-muted-foreground">{stats.disabled}</div>
            <div className="text-xs text-muted-foreground">Disabled</div>
          </Card>
        </div>

        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-2">Browsers</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byBrowser).map(([k, v]) => (
              <span key={k} className="px-2 py-1 rounded bg-muted text-xs">
                {k}: <b>{v}</b>
              </span>
            ))}
            {!Object.keys(stats.byBrowser).length && <span className="text-xs text-muted-foreground">No data</span>}
          </div>
          <h3 className="font-semibold text-sm mt-4 mb-2">Devices</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byDevice).map(([k, v]) => (
              <span key={k} className="px-2 py-1 rounded bg-muted text-xs">
                {k}: <b>{v}</b>
              </span>
            ))}
            {!Object.keys(stats.byDevice).length && <span className="text-xs text-muted-foreground">No data</span>}
          </div>
        </Card>

        {queueStats && (
          <Card className="p-4 space-y-3">
            <h3 className="font-semibold text-sm">Notification Queue</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Pending" value={queueStats.pending} />
              <Stat label="Sent" value={queueStats.sent} />
              <Stat label="Delivered" value={queueStats.delivered} tone="green" />
              <Stat label="Clicked" value={queueStats.clicked} tone="green" />
              <Stat label="Failed" value={queueStats.failed} tone="red" />
              <Stat label="Grouped" value={queueStats.grouped} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t">
              <Stat label="Offline >5m" value={queueStats.offline_queue} tone="amber" />
              <Stat label="Delivered 24h" value={queueStats.delivered_24h} tone="green" />
              <Stat label="Failed 24h" value={queueStats.failed_24h} tone="red" />
            </div>
            <div className="text-xs text-muted-foreground">
              Success rate (24h):{' '}
              <b>
                {(() => {
                  const d = queueStats.delivered_24h;
                  const f = queueStats.failed_24h;
                  const t = d + f;
                  return t ? `${Math.round((d / t) * 100)}%` : '—';
                })()}
              </b>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => runFn('dispatch-queue', 'Dispatch')}>
                {busy === 'dispatch-queue' ? '…' : 'Dispatch now'}
              </Button>
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => runFn('group-pending-notifications', 'Group')}>
                {busy === 'group-pending-notifications' ? '…' : 'Group pending'}
              </Button>
              <Button size="sm" variant="outline" disabled={!!busy} onClick={reprocessFailed}>
                {busy === 'reprocess' ? '…' : 'Reprocess failed (1h)'}
              </Button>
              <Button size="sm" variant="ghost" onClick={loadQueueStats}>Refresh</Button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug pt-2 border-t">
              FCM queues pushes on Google's servers for up to 24h when devices are
              offline and delivers them automatically on reconnect. iOS Safari
              requires the user to install the PWA to the home screen first.
              Some Android OEMs (Xiaomi/Huawei) may suspend Chrome's push channel
              in battery-saving mode.
            </p>
          </Card>
        )}

        {advStats && (
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Engagement Analytics (7d / 24h)</h3>
              <Button size="sm" variant="ghost" onClick={loadAdvancedStats}>Refresh</Button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Delivery rate" value={`${Math.round((advStats.delivery_rate || 0) * 100)}%`} tone="green" />
              <Stat label="CTR" value={`${Math.round((advStats.ctr || 0) * 100)}%`} tone="green" />
              <Stat label="Retry depth" value={advStats.retry_depth ?? 0} tone="amber" />
              <Stat label="Dead tokens 24h" value={advStats.dead_tokens_24h ?? 0} tone="red" />
              <Stat label="Dismissed 24h" value={advStats.counts?.dismissed ?? 0} />
              <Stat label="Clicked 24h" value={advStats.counts?.clicked ?? 0} tone="green" />
            </div>
            <div className="pt-2 border-t">
              <div className="text-xs font-semibold mb-2">Top notification types (7d)</div>
              <div className="space-y-1.5 text-xs">
                {(advStats.top_types || []).map((t: any) => (
                  <div key={t.type} className="flex items-center justify-between gap-2">
                    <span className="truncate">{t.type}</span>
                    <span className="text-muted-foreground shrink-0">
                      {t.total} total · {t.sent} sent · CTR {Math.round((t.ctr || 0) * 100)}%
                    </span>
                  </div>
                ))}
                {!(advStats.top_types || []).length && (
                  <div className="text-muted-foreground">No data yet</div>
                )}
              </div>
            </div>
          </Card>
        )}

        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <h3 className="font-semibold">Send Test Notification</h3>
          </div>
          <Input
            placeholder="Search user by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger>
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              {filteredUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name || u.email || u.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={sendTest} disabled={sending || !selectedUser} className="w-full">
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Sending…' : 'Send Test'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Sends "P4NO Test Notification" to every active device of the selected user.
          </p>
          {lastError && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <div className="text-xs font-semibold text-destructive mb-1">
                Last error
              </div>
              <pre className="text-[10px] leading-snug whitespace-pre-wrap break-all max-h-60 overflow-auto">
                {JSON.stringify(lastError, null, 2)}
              </pre>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'green' | 'red' | 'amber';
}) {
  const color =
    tone === 'green'
      ? 'text-green-600'
      : tone === 'red'
      ? 'text-red-600'
      : tone === 'amber'
      ? 'text-amber-600'
      : '';
  return (
    <div className="rounded bg-muted/40 p-2">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}