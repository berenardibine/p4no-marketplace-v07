// P4NO Enterprise Feature Toggle System
// -----------------------------------------------------------------
// A single registry of platform modules that can be completely shut down.
// "Off" means the module behaves as if it does not exist: no UI, no routes,
// no hooks, no PostgREST reads/writes, no polling, no realtime, no static
// generation, no cache, no background jobs.
//
// Design notes:
//  • Flags are read ONCE per session (tiny row set) and mirrored into
//    localStorage so guards answer synchronously on first paint.
//  • Every guard is a pure sync function — safe to call in render, in
//    fetchers, and before any supabase call.
//  • New modules register by adding one entry to FEATURE_REGISTRY; the
//    admin UI, guards and monitoring pick them up automatically.

import { supabase } from '@/integrations/supabase/client';

export type FeatureKey =
  | 'categories_section'
  | 'reels_module'
  | 'articles_module'
  | 'new_arrivals'
  | 'recently_viewed'
  | 'best_deals'
  | 'popular_this_week'
  | 'mark_order_system'
  | 'homepage_shop_section';

export interface FeatureMeta {
  key: FeatureKey | string;
  label: string;
  description: string;
  category: 'module' | 'homepage' | 'tracking' | 'commerce';
  dependencies: string[];
  /** Static content prefixes purged / never generated when disabled. */
  staticPaths: string[];
  /** Tables that must receive ZERO requests while disabled. */
  tables: string[];
  /** Background jobs / edge functions that must exit immediately. */
  jobs: string[];
  estDbSavings: string;
  estEgressSavings: string;
  /** Rough per-1k-visits egress in KB, used for savings estimates. */
  egressKbPerVisit: number;
  readsPerVisit: number;
}

/** Static registry — future modules only need one entry here. */
export const FEATURE_REGISTRY: FeatureMeta[] = [
  {
    key: 'categories_section',
    label: 'Categories Section',
    description: 'Homepage category grid & carousel only. Product category logic keeps working.',
    category: 'homepage',
    dependencies: [],
    staticPaths: ['categories/'],
    tables: ['categories'],
    jobs: [],
    estDbSavings: '~3 reads / visit',
    estEgressSavings: '~40 KB / visit',
    egressKbPerVisit: 40,
    readsPerVisit: 3,
  },
  {
    key: 'reels_module',
    label: 'Reels Module',
    description: 'Reels pages, homepage strip, uploads, product-detail reels, APIs, recommendations, notifications and static generation.',
    category: 'module',
    dependencies: ['products'],
    staticPaths: ['reels/'],
    tables: ['products'],
    jobs: ['static-worker:reel', 'generate-recommendations:reel'],
    estDbSavings: '~12 reads / visit',
    estEgressSavings: '~400 KB / visit',
    egressKbPerVisit: 400,
    readsPerVisit: 12,
  },
  {
    key: 'articles_module',
    label: 'Articles Module',
    description: 'Insights/articles pages, search indexing, caching, generation, recommendations and notifications.',
    category: 'module',
    dependencies: [],
    staticPaths: ['articles/', 'insights/'],
    tables: ['insight_articles', 'insight_categories', 'insight_article_views'],
    jobs: ['static-worker:article', 'weekly-digest:article'],
    estDbSavings: '~8 reads / visit',
    estEgressSavings: '~250 KB / visit',
    egressKbPerVisit: 250,
    readsPerVisit: 8,
  },
  {
    key: 'new_arrivals',
    label: 'New Arrivals',
    description: 'Homepage "New Arrivals" section, its generation and its analytics.',
    category: 'homepage',
    dependencies: ['products'],
    staticPaths: ['feeds/new-arrivals'],
    tables: ['products'],
    jobs: [],
    estDbSavings: '~2 reads / visit',
    estEgressSavings: '~60 KB / visit',
    egressKbPerVisit: 60,
    readsPerVisit: 2,
  },
  {
    key: 'recently_viewed',
    label: 'Recently Viewed',
    description: 'Browsing-history tracking, IndexedDB writes, history page and view-based recommendations.',
    category: 'tracking',
    dependencies: [],
    staticPaths: [],
    tables: ['browsing_history', 'user_browsing_history'],
    jobs: ['track-interest'],
    estDbSavings: '~4 writes / visit',
    estEgressSavings: '~30 KB / visit',
    egressKbPerVisit: 30,
    readsPerVisit: 4,
  },
  {
    key: 'best_deals',
    label: 'Best Deals',
    description: 'Today Best Deals calculations, scheduled snapshots, APIs and homepage rendering.',
    category: 'homepage',
    dependencies: ['products'],
    staticPaths: ['feeds/best-deals'],
    tables: ['products'],
    jobs: [],
    estDbSavings: '~2 reads / visit',
    estEgressSavings: '~50 KB / visit',
    egressKbPerVisit: 50,
    readsPerVisit: 2,
  },
  {
    key: 'popular_this_week',
    label: 'Popular This Week',
    description: 'Popularity calculations, weekly snapshots, cron worker, APIs and all "Popular This Week" widgets.',
    category: 'homepage',
    dependencies: ['products', 'services'],
    staticPaths: ['products/popular', 'services/popular', 'reels/popular', 'articles/popular'],
    tables: ['weekly_views', 'popular_weekly_snapshots', 'product_weekly_stats'],
    jobs: ['compute-weekly-popular'],
    estDbSavings: '~6 reads / visit',
    estEgressSavings: '~80 KB / visit',
    egressKbPerVisit: 80,
    readsPerVisit: 6,
  },
  {
    key: 'mark_order_system',
    label: 'Mark & Order System',
    description: 'Cart / mark & order workflow, order APIs, background processing, imports and order notifications.',
    category: 'commerce',
    dependencies: ['products'],
    staticPaths: [],
    tables: ['orders', 'order_items'],
    jobs: ['dispatch-queue:order'],
    estDbSavings: '~5 reads / order',
    estEgressSavings: '~20 KB / visit',
    egressKbPerVisit: 20,
    readsPerVisit: 5,
  },
  {
    key: 'homepage_shop_section',
    label: 'Homepage Shop Section',
    description: '"Shop Near Me" homepage block only. Seller shop pages keep working normally.',
    category: 'homepage',
    dependencies: ['shops'],
    staticPaths: ['shops/all'],
    tables: ['shops'],
    jobs: [],
    estDbSavings: '~2 reads / visit',
    estEgressSavings: '~45 KB / visit',
    egressKbPerVisit: 45,
    readsPerVisit: 2,
  },
];

export const FEATURE_MAP: Record<string, FeatureMeta> = Object.fromEntries(
  FEATURE_REGISTRY.map((f) => [f.key, f]),
);

const LS_KEY = 'p4no_feature_flags_v1';

/** Default: everything ON (fail-open so a fetch error never blanks the site). */
const state: Record<string, boolean> = Object.fromEntries(
  FEATURE_REGISTRY.map((f) => [f.key, true]),
);

let loaded = false;
let inflight: Promise<Record<string, boolean>> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => {
    try { l(); } catch { /* ignore */ }
  });
}

// Hydrate synchronously from localStorage so the very first render is correct.
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'boolean') state[k] = v;
      }
    }
  } catch { /* ignore */ }
}

function persist() {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

/** Synchronous guard — the single source of truth used everywhere. */
export function isFeatureEnabled(key: FeatureKey | string): boolean {
  return state[key] !== false;
}

/** Guard for code paths: returns true when the caller must bail out. */
export function isFeatureDisabled(key: FeatureKey | string): boolean {
  return !isFeatureEnabled(key);
}

export function getFeatureState(): Record<string, boolean> {
  return { ...state };
}

export function subscribeFeatureFlags(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * One tiny read per session (9 rows, ~1 KB). Deduped and cached.
 * Never called from a render loop.
 */
export function loadFeatureFlags(force = false): Promise<Record<string, boolean>> {
  if (loaded && !force) return Promise.resolve(getFeatureState());
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data } = await (supabase as any)
        .from('feature_flags')
        .select('key, enabled');
      if (Array.isArray(data)) {
        for (const row of data) state[row.key] = row.enabled !== false;
        loaded = true;
        persist();
        notify();
      }
    } catch { /* fail-open */ }
    inflight = null;
    return getFeatureState();
  })();
  return inflight;
}

/** Admin-only write. Purges the module's cached static content on disable. */
export async function setFeatureEnabled(key: string, enabled: boolean): Promise<void> {
  const { error } = await (supabase as any)
    .from('feature_flags')
    .update({ enabled })
    .eq('key', key);
  if (error) throw error;
  state[key] = enabled;
  persist();
  notify();
  if (!enabled) await purgeFeatureCache(key);
}

/** Cache Guard — delete every cached artifact belonging to a disabled module. */
export async function purgeFeatureCache(key: string): Promise<number> {
  const meta = FEATURE_MAP[key];
  if (!meta || meta.staticPaths.length === 0) return 0;
  const { idbKeys, idbDelete } = await import('./idbCache');
  let removed = 0;
  try {
    const keys = await idbKeys();
    for (const k of keys) {
      if (meta.staticPaths.some((p) => k.includes(p))) {
        await idbDelete(k);
        removed++;
      }
    }
  } catch { /* ignore */ }
  try {
    const { invalidatePrefix } = await import('./dataAccess');
    meta.staticPaths.forEach((p) => invalidatePrefix(p));
  } catch { /* ignore */ }
  return removed;
}

/** Tables that must be blocked entirely because their module is off. */
export function disabledFeatureTables(): Set<string> {
  const out = new Set<string>();
  for (const f of FEATURE_REGISTRY) {
    if (isFeatureEnabled(f.key)) continue;
    // Only block tables that are exclusive to this module.
    const exclusive = f.tables.filter(
      (t) => !FEATURE_REGISTRY.some((o) => o.key !== f.key && isFeatureEnabled(o.key) && o.tables.includes(t)),
    );
    exclusive.forEach((t) => out.add(t));
  }
  // Shared core tables are never fully blocked.
  ['products', 'services', 'shops', 'profiles', 'categories'].forEach((t) => out.delete(t));
  return out;
}

/** Static Generator Guard — used by the client + mirrored server-side. */
export function isStaticPathAllowed(path: string): boolean {
  for (const f of FEATURE_REGISTRY) {
    if (isFeatureEnabled(f.key)) continue;
    if (f.staticPaths.some((p) => path.startsWith(p))) return false;
  }
  return true;
}

/** Search Guard — drop disabled module rows from the search index. */
export function filterSearchIndex<T extends { type?: string }>(rows: T[]): T[] {
  const reels = isFeatureEnabled('reels_module');
  const articles = isFeatureEnabled('articles_module');
  if (reels && articles) return rows;
  return rows.filter((r) => {
    if (!reels && (r.type === 'reel' || r.type === 'reels')) return false;
    if (!articles && (r.type === 'article' || r.type === 'articles')) return false;
    return true;
  });
}
