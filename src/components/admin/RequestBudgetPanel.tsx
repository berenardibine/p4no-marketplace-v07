// Request budget, stampede protection and traffic anomalies.
// Extracted from the old Enterprise Traffic Dashboard so the unified monitor is
// the single home for these views. Purely in-memory stores — zero DB reads,
// zero polling: it re-renders only when a real delivery event mutates a store.

import { useSyncExternalStore } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Gauge, Shield } from 'lucide-react';
import { getStampedeStats, subscribeStampede } from '@/lib/stampede';
import {
  DEFAULT_DB_BUDGET,
  DEFAULT_TOTAL_BUDGET,
  getBudgetSnapshot,
  subscribeBudget,
} from '@/lib/requestBudget';

function fmtBytes(n: number) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: 'good' | 'warn' }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${tone === 'warn' && value > 0 ? 'text-destructive' : ''}`}>
        {value}
      </div>
    </div>
  );
}

export default function RequestBudgetPanel() {
  const budget = useSyncExternalStore(subscribeBudget, getBudgetSnapshot, getBudgetSnapshot);
  const stampede = useSyncExternalStore(subscribeStampede, getStampedeStats, getStampedeStats);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" /> Stampede protection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <MiniStat label="Coalesced requests" value={stampede.coalesced} tone="good" />
            <MiniStat label="Negative-cache hits" value={stampede.negativeHits} tone="good" />
            <MiniStat label="Fallbacks allowed" value={stampede.fallbacksAllowed} tone="warn" />
            <MiniStat label="Fallbacks suppressed" value={stampede.fallbacksSuppressed} tone="good" />
            <MiniStat label="Breaker blocks" value={stampede.breakerOpen} tone="warn" />
          </div>
          <p className="text-xs text-muted-foreground">
            Concurrent readers of the same resource share one origin request. Confirmed-missing paths are
            cached negatively, and each path allows at most one database fallback per 30s window before the
            circuit breaker opens.
            {stampede.openBreakers.length > 0 && (
              <> Open breakers: <span className="font-mono">{stampede.openBreakers.join(', ')}</span>.</>
            )}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4" /> Request budget per page
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Budget: max {DEFAULT_DB_BUDGET} database reads and {DEFAULT_TOTAL_BUDGET} total reads per page
            view. Current page <span className="font-mono">{budget.currentRoute}</span> — {budget.visitDb} DB /{' '}
            {budget.visitTotal} total.
          </p>
          {budget.routes.length === 0 && (
            <p className="text-sm text-muted-foreground">No page views recorded in this tab yet.</p>
          )}
          {budget.routes.map((r) => (
            <div key={r.route} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-mono text-xs">{r.route}</span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary">{r.visits} views</Badge>
                <Badge variant="outline">{r.total} reads</Badge>
                {r.db > 0 ? <Badge variant="destructive">{r.db} DB</Badge> : <Badge variant="outline">0 DB</Badge>}
                {r.breaches > 0 && <Badge variant="destructive">{r.breaches} over budget</Badge>}
                <span className="text-xs text-muted-foreground">{fmtBytes(r.bytes)}</span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" /> Traffic anomalies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {budget.alerts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No budget breaches, N+1 patterns, or abnormal page traffic detected.
            </p>
          )}
          {budget.alerts.map((a, i) => (
            <div key={`${a.route}-${a.kind}-${i}`} className="flex items-start justify-between gap-2 text-xs">
              <span className="truncate">
                <span className="font-mono">{a.route}</span> — {a.note}
              </span>
              <Badge variant="destructive" className="shrink-0">{a.kind}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
