// Per-page request budget
// ------------------------
// Every delivery-layer read is attributed to the route that triggered it, so we
// can answer "how many PostgREST requests does this page cost?" and flag any
// page that suddenly starts hammering the database.
//
// Fed by trafficTelemetry.recordTraffic — no extra instrumentation, no polling,
// no database writes.

import type { TrafficLayer } from './trafficTelemetry';

export interface RouteBudget {
  route: string;
  total: number;
  memory: number;
  browser: number;
  idb: number;
  cdn: number;
  db: number;
  bytes: number;
  dbBytes: number;
  visits: number;
  breaches: number;
  lastAt: number;
}

/** Max PostgREST reads a single page view may cost before we flag it. */
export const DEFAULT_DB_BUDGET = 3;
/** Max total delivery-layer reads per page view before we flag an N+1 pattern. */
export const DEFAULT_TOTAL_BUDGET = 60;

export interface BudgetAlert {
  route: string;
  kind: 'db-budget' | 'total-budget' | 'n-plus-one';
  observed: number;
  budget: number;
  at: number;
  note: string;
}

const routes = new Map<string, RouteBudget>();
const alerts: BudgetAlert[] = [];
const ALERT_KEEP = 40;

// Per-visit counters, reset on navigation.
let currentRoute = '/';
let visitDb = 0;
let visitTotal = 0;
const visitPaths = new Map<string, number>();

const listeners = new Set<() => void>();
function notify() {
  cached = null;
  listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
}

export function subscribeBudget(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Collapse dynamic segments so /product/abc and /product/xyz share a budget. */
export function normalizeRoute(pathname: string): string {
  return (
    pathname
      .replace(/\/+$/, '')
      .split('/')
      .map((seg) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) || /^\d+$/.test(seg) || seg.length > 24
          ? ':id'
          : seg,
      )
      .join('/') || '/'
  );
}

function row(route: string): RouteBudget {
  let r = routes.get(route);
  if (!r) {
    r = {
      route,
      total: 0, memory: 0, browser: 0, idb: 0, cdn: 0, db: 0,
      bytes: 0, dbBytes: 0, visits: 0, breaches: 0, lastAt: 0,
    };
    routes.set(route, r);
  }
  return r;
}

function pushAlert(a: BudgetAlert) {
  const dup = alerts[0];
  if (dup && dup.route === a.route && dup.kind === a.kind && a.at - dup.at < 5000) return;
  alerts.unshift(a);
  if (alerts.length > ALERT_KEEP) alerts.length = ALERT_KEEP;
  row(a.route).breaches += 1;
}

/** Call on every client-side navigation. Starts a fresh per-view budget. */
export function startPageView(pathname: string): void {
  currentRoute = normalizeRoute(pathname);
  visitDb = 0;
  visitTotal = 0;
  visitPaths.clear();
  row(currentRoute).visits += 1;
  notify();
}

export function recordBudgetEvent(layer: TrafficLayer, bytes: number, path: string): void {
  const route =
    currentRoute ||
    (typeof window !== 'undefined' ? normalizeRoute(window.location.pathname) : '/');
  const r = row(route);
  r.total += 1;
  r[layer] += 1;
  r.bytes += Math.max(0, bytes || 0);
  r.lastAt = Date.now();
  if (layer === 'db') r.dbBytes += Math.max(0, bytes || 0);

  visitTotal += 1;
  if (layer === 'db') visitDb += 1;

  // N+1 detection: the same resource family requested many times in one view.
  const family = path.split('/').slice(0, 2).join('/');
  const n = (visitPaths.get(family) ?? 0) + 1;
  visitPaths.set(family, n);

  const now = Date.now();
  if (visitDb === DEFAULT_DB_BUDGET + 1) {
    pushAlert({
      route, kind: 'db-budget', observed: visitDb, budget: DEFAULT_DB_BUDGET, at: now,
      note: `Page exceeded its PostgREST budget (${visitDb} database reads in one view).`,
    });
  }
  if (visitTotal === DEFAULT_TOTAL_BUDGET + 1) {
    pushAlert({
      route, kind: 'total-budget', observed: visitTotal, budget: DEFAULT_TOTAL_BUDGET, at: now,
      note: `Page issued ${visitTotal} delivery-layer reads in one view.`,
    });
  }
  if (layer === 'db' && n === 6) {
    pushAlert({
      route, kind: 'n-plus-one', observed: n, budget: 5, at: now,
      note: `Possible N+1: "${family}/*" fetched ${n} times from the database in one view.`,
    });
  }
  notify();
}

export interface BudgetSnapshot {
  routes: RouteBudget[];
  alerts: BudgetAlert[];
  currentRoute: string;
  visitDb: number;
  visitTotal: number;
  worstRoute: RouteBudget | null;
}

let cached: BudgetSnapshot | null = null;
const origNotify = notify;

export function getBudgetSnapshot(): BudgetSnapshot {
  if (cached) return cached;
  const list = Array.from(routes.values()).sort((a, b) => b.db - a.db || b.total - a.total);
  cached = {
    routes: list.slice(0, 20),
    alerts: alerts.slice(0, 20),
    currentRoute,
    visitDb,
    visitTotal,
    worstRoute: list[0] ?? null,
  };
  return cached;
}

export function resetBudget(): void {
  routes.clear();
  alerts.length = 0;
  visitDb = 0;
  visitTotal = 0;
  visitPaths.clear();
  cached = null;
  origNotify();
}

// Invalidate the memoised snapshot whenever anything changes.
listeners.add(() => { cached = null; });
