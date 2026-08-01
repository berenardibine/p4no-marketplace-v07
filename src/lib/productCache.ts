// Product content is now served from the CDN via the Traffic Guard.
// Legacy Redis-style helpers are kept as compatibility shims so every
// existing hook (useProducts, useCategories, ...) automatically goes
// through the CDN → IndexedDB pipeline without per-file migrations.
//
// See src/lib/cdnGuard.ts for the layered fetcher.

import { getContent, markViolation } from './cdnGuard';
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
