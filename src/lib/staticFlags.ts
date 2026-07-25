// Feature flags for the CDN-first static content architecture.
// Each surface can be toggled independently while we migrate off Redis.
//
// VITE_STATIC_CDN=1              → master enable (any surface flag also enables)
// VITE_STATIC_CDN_PRODUCTS=1     → serve products from Blob/CDN
// VITE_STATIC_CDN_SERVICES=1     → serve services from Blob/CDN
// VITE_STATIC_CDN_REELS=1        → serve reels from Blob/CDN
// VITE_STATIC_CDN_ARTICLES=1     → serve articles from Blob/CDN
// VITE_STATIC_CDN_CATEGORIES=1   → serve categories from Blob/CDN
//
// VITE_STRICT_STATIC_MODE=1      → Traffic Guard forbids Supabase fallback for public reads.
//                                  When a static file is missing, the guard queues a
//                                  regeneration and returns `null` (UI shows "Content is
//                                  updating.") instead of hitting PostgREST.


// Enterprise Traffic Engine V2: static delivery is ON by default.
// Opt-out with VITE_STATIC_CDN=0 / VITE_STATIC_ONLY=0 / VITE_STRICT_STATIC_MODE=0.
const falsy = (v: unknown) => {
  const s = (v ?? '').toString().trim().toLowerCase();
  return s === '0' || s === 'false' || s === 'no' || s === 'off';
};
const enabledDefault = (v: unknown) => !falsy(v);

const MASTER = enabledDefault(import.meta.env.VITE_STATIC_CDN);
const STATIC_ONLY_MASTER = enabledDefault(import.meta.env.VITE_STATIC_ONLY);

export const STATIC_CDN = {
  base: (import.meta.env.VITE_STATIC_CDN_BASE ?? '').toString().replace(/\/+$/, ''),
  master: MASTER,
  products: MASTER,
  services: MASTER,
  reels: MASTER,
  articles: MASTER,
  categories: MASTER,
} as const;

/**
 * STATIC_ONLY: when true, public read hooks MUST NOT fall back to Supabase.
 * Default ON — set VITE_STATIC_ONLY=0 to disable per-surface fallback.
 */
export const STATIC_ONLY = {
  master: STATIC_ONLY_MASTER,
  products: STATIC_ONLY_MASTER,
  services: STATIC_ONLY_MASTER,
  reels: STATIC_ONLY_MASTER,
  articles: STATIC_ONLY_MASTER,
  categories: STATIC_ONLY_MASTER,
} as const;

/**
 * STRICT_STATIC_MODE — kill switch for public Supabase reads.
 * Default ON per Traffic Engine V2. Set VITE_STRICT_STATIC_MODE=0 to disable.
 */
const STRICT_ENV = enabledDefault(import.meta.env.VITE_STRICT_STATIC_MODE);

export function isStrictStaticMode(): boolean {
  if (typeof window !== 'undefined') {
    const w = (window as any).__P4NO_STRICT__;
    if (typeof w === 'boolean') return w;
  }
  return STRICT_ENV;
}

export function setStrictStaticMode(on: boolean): void {
  if (typeof window !== 'undefined') {
    (window as any).__P4NO_STRICT__ = on;
    try { localStorage.setItem('p4no_strict_static', on ? '1' : '0'); } catch { /* ignore */ }
  }
}

// Restore persisted preference on load.
if (typeof window !== 'undefined') {
  try {
    const persisted = localStorage.getItem('p4no_strict_static');
    if (persisted === '1') (window as any).__P4NO_STRICT__ = true;
    if (persisted === '0') (window as any).__P4NO_STRICT__ = false;
  } catch { /* ignore */ }
}

export type StaticSurface = 'products' | 'services' | 'reels' | 'articles' | 'categories';

export const isStaticEnabled = (s: StaticSurface): boolean => STATIC_CDN[s];
export const isStaticOnly = (s: StaticSurface): boolean => STATIC_ONLY[s] || isStrictStaticMode();
