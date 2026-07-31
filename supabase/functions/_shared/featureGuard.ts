// P4NO Enterprise Feature Toggle System — server-side guard.
// ------------------------------------------------------------------
// Every worker, cron job, scheduler and edge function must call one of
// these helpers BEFORE touching any other table. A disabled module exits
// immediately: no generation, no cache writes, no notifications, no reads.
//
// Flags live in public.feature_flags (key, enabled). They are cached in
// module memory for CACHE_TTL_MS so a hot worker performs at most one
// tiny read per minute.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CACHE_TTL_MS = 60_000;

let cache: Record<string, boolean> = {};
let fetchedAt = 0;
let inflight: Promise<Record<string, boolean>> | null = null;

/** Fetch the flag map (cached). Fails OPEN so an outage never stops jobs. */
export async function getFeatureFlags(force = false): Promise<Record<string, boolean>> {
  const now = Date.now();
  if (!force && now - fetchedAt < CACHE_TTL_MS) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/feature_flags?select=key,enabled`, {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      });
      if (res.ok) {
        const rows = (await res.json()) as { key: string; enabled: boolean }[];
        const next: Record<string, boolean> = {};
        for (const r of rows) next[r.key] = r.enabled !== false;
        cache = next;
        fetchedAt = Date.now();
      }
    } catch {
      /* fail open */
    }
    inflight = null;
    return cache;
  })();
  return inflight;
}

/** True unless the flag row explicitly says disabled. */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags[key] !== false;
}

export async function isFeatureDisabled(key: string): Promise<boolean> {
  return !(await isFeatureEnabled(key));
}

/**
 * Background Guard. Returns a ready-to-return Response when the module is
 * off, or null when the job may continue.
 *
 *   const stop = await guardFeature("popular_this_week", corsHeaders);
 *   if (stop) return stop;
 */
export async function guardFeature(
  key: string,
  corsHeaders: Record<string, string> = {},
): Promise<Response | null> {
  if (await isFeatureEnabled(key)) return null;
  return new Response(
    JSON.stringify({ ok: true, skipped: true, reason: "feature_disabled", feature: key }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/** Static generation entity → owning feature. Entities absent here are core. */
export const ENTITY_FEATURE: Record<string, string> = {
  reel: "reels_module",
  reels: "reels_module",
  article: "articles_module",
  articles: "articles_module",
  insight: "articles_module",
};

/** Static Generator Guard — never generate JSON for a disabled module. */
export async function isEntityAllowed(entity: string): Promise<boolean> {
  const key = ENTITY_FEATURE[entity];
  if (!key) return true;
  return await isFeatureEnabled(key);
}

/** Static path prefixes that must never be generated while a module is off. */
const FEATURE_STATIC_PATHS: Record<string, string[]> = {
  reels_module: ["reels/", "reel/"],
  articles_module: ["articles/", "insights/", "article/"],
  categories_section: ["categories/"],
  new_arrivals: ["feeds/new-arrivals"],
  best_deals: ["feeds/best-deals"],
  popular_this_week: ["products/popular", "services/popular", "feeds/popular"],
  recently_viewed: ["feeds/recently-viewed", "recommendations/"],
  homepage_shop_section: ["shops/all"],
  mark_order_system: [],
};


export async function isStaticPathAllowed(path: string): Promise<boolean> {
  const flags = await getFeatureFlags();
  for (const [key, prefixes] of Object.entries(FEATURE_STATIC_PATHS)) {
    if (flags[key] === false && prefixes.some((p) => path.startsWith(p))) return false;
  }
  return true;
}
