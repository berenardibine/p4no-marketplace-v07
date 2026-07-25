// Services / Reels / Articles content is now served from the CDN via the
// Traffic Guard. Legacy Redis-style helpers are compatibility shims that
// route all reads through the CDN → IndexedDB pipeline.
//
// See src/lib/cdnGuard.ts for the layered fetcher.

import { getContent, markViolation } from './cdnGuard';

function pageSlice<T>(rows: T[] | null | undefined, page: number, pageSize: number, path: string): T[] | null {
  if (!Array.isArray(rows)) {
    markViolation(path, 'shim-null');
    return null;
  }
  const from = page * pageSize;
  return rows.slice(from, from + pageSize);
}

// ---------- Services ----------
type ServiceKind = 'latest' | 'featured' | 'trending' | 'popular' | 'category';

export const getCachedServices = async (
  kind: ServiceKind,
  slug?: string,
  page = 0,
  pageSize = 100,
) => {
  const path =
    kind === 'category' && slug
      ? `services/category/${slug}`
      : kind === 'featured'
      ? 'services/featured'
      : kind === 'trending'
      ? 'services/trending'
      : kind === 'popular'
      ? 'services/trending'
      : 'services/latest';
  const rows = await getContent<any[]>(path);
  return pageSlice(rows, page, pageSize, path);
};

export const getCachedServiceCategories = async () => {
  return getContent<any[]>('categories/services');
};

export const getCachedServiceDetail = async (slugOrId: string) => {
  return getContent<any>(`service/${slugOrId}`);
};

// ---------- Reels ----------
export const getCachedReels = async (
  kind: 'latest' | 'trending',
  page = 0,
  pageSize = 100,
) => {
  const path = kind === 'trending' ? 'reels/trending' : 'reels/latest';
  const rows = await getContent<any[]>(path);
  return pageSlice(rows, page, pageSize, path);
};

export const getCachedReelDetail = async (slugOrId: string) => {
  return getContent<any>(`product/${slugOrId}`);
};

// ---------- Articles ----------
export const getCachedArticles = async (
  kind: 'latest' | 'popular' | 'category',
  slug?: string,
  page = 0,
  pageSize = 12,
) => {
  const path =
    kind === 'category' && slug
      ? `articles/category/${slug}`
      : kind === 'popular'
      ? 'articles/trending'
      : 'articles/latest';
  const rows = await getContent<any[]>(path);
  if (!Array.isArray(rows)) return null;
  const from = page * pageSize;
  return { rows: rows.slice(from, from + pageSize), count: rows.length };
};

export const getCachedArticleDetail = async (slug: string) => {
  return getContent<any>(`article/${slug}`);
};
