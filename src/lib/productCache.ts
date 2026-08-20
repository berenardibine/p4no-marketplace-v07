// Product content is now served from the CDN via the Traffic Guard.
// Legacy Redis-style helpers are kept as compatibility shims so every
// existing hook (useProducts, useCategories, ...) automatically goes
// through the CDN → IndexedDB pipeline without per-file migrations.
//
// See src/lib/cdnGuard.ts for the layered fetcher.

import { getContent, getContentResolved, isPathPublished, markViolation } from './cdnGuard';
import { productStaticPath } from './productShard';

export type ListKind = 'latest' | 'featured' | 'popular' | 'discounted' | 'trending' | 'popular-week';

function pageSlice<T>(rows: T[] | null | undefined, page: number, pageSize: number, path: string): T[] | null {
  if (!Array.isArray(rows)) {
    markViolation(path, 'shim-null');
    return null;
  }
  const from = page * pageSize;
  return rows.slice(from, from + pageSize);
}

export async function getCachedList(kind: ListKind, page = 0, pageSize = 100) {
  // Map legacy kinds to CDN paths written by static-generate.
  const map: Record<ListKind, string> = {
    latest: 'products/latest',
    featured: 'products/featured',
    popular: 'products/popular',
    trending: 'products/trending',
    discounted: 'products/latest', // discounted list not generated separately yet
    'popular-week': 'products/popular',
  };
  const path = map[kind];
  const rows = await getContent<any[]>(path);
  return pageSlice(rows, page, pageSize, path);
}

export async function getCachedCategory(slug: string, page = 0, pageSize = 100) {
  const path = `products/category/${slug}`;
  const rows = await getContent<any[]>(path);
  return pageSlice(rows, page, pageSize, path);
}

/**
 * V3 sharded product detail: products/<shard>/<slug>.json.
 * The shard is computed locally from the slug, so there is no lookup and no
 * database read. Falls back once to the legacy flat path for files that have
 * not been migrated yet.
 */
export async function getCachedProductDetail(slug: string) {
  const sharded = await getContent<any>(await productStaticPath(slug));
  if (sharded) return sharded;
  return getContent<any>(`product/${slug}`);
}

/**
 * Resolved product detail read: distinguishes a genuinely missing product
 * (origin 404 + not published in the manifest) from a delivery failure
 * (offline / CDN error / manifest unavailable). Cold browsers must never see
 * "Product Not Found" because of a transient delivery problem.
 */
export async function resolveProductDetail(slug: string): Promise<{
  product: any | null;
  outcome: 'hit' | 'missing' | 'unavailable' | 'blocked';
  path: string;
}> {
  const path = await productStaticPath(slug);
  const primary = await getContentResolved<any>(path);
  if (primary.data) return { product: primary.data, outcome: 'hit', path };

  // Legacy flat path for files generated before sharding.
  const legacy = await getContentResolved<any>(`product/${slug}`);
  if (legacy.data) return { product: legacy.data, outcome: 'hit', path: `product/${slug}` };

  // Only trust "missing" when both reads got a definitive 404 AND the published
  // manifest agrees the path does not exist.
  const definitive = primary.outcome === 'missing' && legacy.outcome === 'missing';
  if (definitive) {
    const published = await isPathPublished(path);
    if (published === true) return { product: null, outcome: 'unavailable', path };
    if (published === null) return { product: null, outcome: 'unavailable', path };
    return { product: null, outcome: 'missing', path };
  }
  if (primary.outcome === 'blocked') return { product: null, outcome: 'blocked', path };
  return { product: null, outcome: 'unavailable', path };
}


export async function getCachedHomepage() {
  const [featured, latest, popular, categories] = await Promise.all([
    getContent<any[]>('products/featured'),
    getContent<any[]>('products/latest'),
    getContent<any[]>('products/popular'),
    getContent<any[]>('categories/home'),
  ]);
  if (!featured && !latest && !popular && !categories) return null;
  return {
    featured: featured ?? [],
    latest: latest ?? [],
    popular: popular ?? [],
    discounted: [],
    categories: categories ?? [],
  };
}

export async function getCachedCategories() {
  return getContent<any[]>('categories/all');
}

export async function getCachedPopularWeekly() {
  return getContent<any[]>('products/popular');
}
