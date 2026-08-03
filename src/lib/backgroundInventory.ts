// P4NO Background Request Inventory
// -----------------------------------------------------------------
// A hand-audited registry of EVERY process that is capable of touching the
// database without a direct user action. It powers the Admin ▸ Cache Monitor
// ▸ Infrastructure Audit tab and doubles as living documentation.
//
// Rule: if you add a timer, cron job, worker or background fetch anywhere in
// the codebase, it MUST be registered here. Anything not listed here is
// treated as a hidden request by the audit panel.

export type InvStatus = 'removed' | 'event-driven' | 'cached' | 'active' | 'gated';

export interface BackgroundRequest {
  name: string;
  source: string;
  kind: 'frontend' | 'edge-function' | 'cron' | 'trigger';
  reason: string;
  frequency: string;
  tables: string[];
  reads: string;
  writes: string;
  cache: string;
  status: InvStatus;
  feature?: string;
  note?: string;
}

export const BACKGROUND_INVENTORY: BackgroundRequest[] = [
  // ---------------- Frontend ----------------
  {
    name: 'CDN telemetry beacon',
    source: 'src/lib/cdnGuard.ts',
    kind: 'frontend',
    reason: 'Static-vs-Supabase traffic measurement',
    frequency: 'On tab hide / pagehide only (was: 15s timer)',
    tables: ['cdn_metrics'],
    reads: '0',
    writes: 'batched, opt-in',
    cache: 'in-memory buffer',
    status: 'event-driven',
    note: 'Disabled unless telemetry is explicitly turned on.',
  },
  {
    name: 'Manifest freshness check',
    source: 'src/lib/cdnGuard.ts',
    kind: 'frontend',
    reason: 'Detect new static content',
    frequency: 'On tab focus, max 1 / 5 min',
    tables: [],
    reads: '1 CDN file',
    writes: '0',
    cache: 'IndexedDB + memory',
    status: 'event-driven',
  },
  {
    name: 'Visitor self-heal generation',
    source: 'src/lib/cdnGuard.ts, src/lib/staticCDN.ts',
    kind: 'frontend',
    reason: 'Regenerate a missing JSON file',
    frequency: 'Never (admin opt-in via __P4NO_SELFHEAL__)',
    tables: ['static_manifest', 'static_gen_log', 'generation_locks'],
    reads: '0',
    writes: '0',
    cache: 'n/a',
    status: 'removed',
  },
  {
    name: 'Feature flag load',
    source: 'src/lib/featureFlags.ts',
    kind: 'frontend',
    reason: 'Module on/off state',
    frequency: 'Once per session',
    tables: ['feature_flags'],
    reads: '~12 rows',
    writes: '0',
    cache: 'localStorage (sync first paint)',
    status: 'cached',
  },
  {
    name: 'Product detail fetch',
    source: 'src/hooks/useProductBySlug.tsx',
    kind: 'frontend',
    reason: 'Render a product page',
    frequency: 'User navigation only',
    tables: ['products'],
    reads: 'static JSON first, DB last resort',
    writes: '0',
    cache: 'Browser → IndexedDB → CDN → JSON → DB',
    status: 'cached',
  },
  {
    name: 'Notification unread count',
    source: 'src/hooks/useNotifications.tsx',
    kind: 'frontend',
    reason: 'Bell badge',
    frequency: 'On mount + realtime push (no timer)',
    tables: ['notifications'],
    reads: 'count only',
    writes: '0',
    cache: 'realtime channel',
    status: 'event-driven',
  },
  {
    name: 'Admin cache/blob/row-count loads',
    source: 'src/pages/admin/AdminCacheMonitor.tsx',
    kind: 'frontend',
    reason: 'Admin diagnostics',
    frequency: 'Manual button press',
    tables: ['cdn_metrics', 'static_manifest', 'static_gen_log'],
    reads: 'on demand',
    writes: '0',
    cache: 'none',
    status: 'event-driven',
  },

  // ---------------- Cron / workers ----------------
  {
    name: 'dispatch-queue',
    source: 'supabase/functions/dispatch-queue',
    kind: 'cron',
    reason: 'Deliver queued notifications (essential)',
    frequency: 'Every 5 min (was: every 1 min)',
    tables: ['notification_queue'],
    reads: 'pending rows only',
    writes: 'status updates',
    cache: 'n/a',
    status: 'active',
  },
  {
    name: 'group-pending-notifications',
    source: 'supabase/functions/group-pending-notifications',
    kind: 'cron',
    reason: 'Bundle similar notifications',
    frequency: 'Paused',
    tables: ['notification_queue'],
    reads: '—',
    writes: '—',
    cache: 'n/a',
    status: 'removed',
  },
  {
    name: 'generate-recommendations',
    source: 'supabase/functions/generate-recommendations',
    kind: 'cron',
    reason: 'Build recommendation index',
    frequency: 'Paused + feature-gated',
    tables: ['user_interest_profiles', 'recommendation_index', 'products'],
    reads: '—',
    writes: '—',
    cache: 'n/a',
    status: 'gated',
    feature: 'recommendations',
  },
  {
    name: 'compute-weekly-popular',
    source: 'supabase/functions/compute-weekly-popular',
    kind: 'cron',
    reason: 'Weekly popularity snapshots',
    frequency: 'Paused + feature-gated',
    tables: ['weekly_views', 'product_weekly_stats', 'popular_weekly_snapshots'],
    reads: '—',
    writes: '—',
    cache: 'n/a',
    status: 'gated',
    feature: 'popular_this_week',
  },
  {
    name: 'weekly-digest',
    source: 'supabase/functions/weekly-digest',
    kind: 'cron',
    reason: 'Weekly buyer/seller summary',
    frequency: 'Paused + feature-gated',
    tables: ['profiles', 'products', 'orders'],
    reads: '—',
    writes: '—',
    cache: 'n/a',
    status: 'gated',
    feature: 'weekly_digest',
  },
  {
    name: 'reengagement-push',
    source: 'supabase/functions/reengagement-push',
    kind: 'cron',
    reason: 'Wake inactive users',
    frequency: 'Paused + feature-gated',
    tables: ['profiles', 'notification_logs'],
    reads: '—',
    writes: '—',
    cache: 'n/a',
    status: 'gated',
    feature: 'trending_engine',
  },
  {
    name: 'engagement-jobs (6 sub-jobs)',
    source: 'supabase/functions/engagement-jobs',
    kind: 'cron',
    reason: 'Trending / favorites / lifecycle nudges',
    frequency: 'Paused + feature-gated',
    tables: ['products', 'saved_items', 'browsing_history', 'orders'],
    reads: '—',
    writes: '—',
    cache: 'n/a',
    status: 'gated',
    feature: 'trending_engine',
  },
  {
    name: 'cache-warm',
    source: 'supabase/functions/static-warm',
    kind: 'cron',
    reason: 'Pre-warm CDN files',
    frequency: 'Unscheduled (manual only)',
    tables: ['cache_metrics'],
    reads: '—',
    writes: '—',
    cache: 'n/a',
    status: 'removed',
  },
  {
    name: 'backfill-product-descriptions',
    source: 'supabase/functions/backfill-product-descriptions',
    kind: 'cron',
    reason: 'AI description backfill',
    frequency: 'Unscheduled (was: every 5 min)',
    tables: ['products'],
    reads: '—',
    writes: '—',
    cache: 'n/a',
    status: 'removed',
  },
  {
    name: 'cleanup-browsing-and-weekly-stats',
    source: 'DB function',
    kind: 'cron',
    reason: 'Data retention',
    frequency: 'Paused',
    tables: ['browsing_history', 'weekly_views'],
    reads: '—',
    writes: '—',
    cache: 'n/a',
    status: 'removed',
  },

  // ---------------- Triggers ----------------
  {
    name: 'Static regeneration enqueue',
    source: 'enqueue_generation() trigger',
    kind: 'trigger',
    reason: 'Content changed → rebuild affected JSON',
    frequency: 'Only on product/service/article write',
    tables: ['generation_queue'],
    reads: '0',
    writes: '1 row per change',
    cache: 'n/a',
    status: 'event-driven',
  },
];

export const ESSENTIAL_JOBS = ['dispatch-queue-1min', 'dispatch-queue'];
