// Recommendation delivery.
// ------------------------------------------------------------------
// `/functions/v1/get-recommendations` costs ~4.6 KB per product view and was
// (a) called with a hard-coded URL + anon key belonging to a DIFFERENT Supabase
// project, and (b) re-issued on every mount / remount of the same product.
//
// Fixes:
//   • correct project URL + publishable key from the env
//   • coalesce identical (product, page) calls so concurrent mounts share one
//     request
//   • 10-minute TTL cache so revisiting the same product costs zero calls
//   • the Edge Function request stays fully visible to telemetry (apiFirewall
//     records `/functions/v1/*` as an `edge_function` class) — it is optimised,
//     not hidden.

import { cachedQuery } from './queryCache';
import { coalesce } from './stampede';

export interface RecommendationResult {
  products: any[];
  hasMore: boolean;
}

const TTL_MS = 10 * 60_000;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function callEdge(productId: string, page: number, limit: number): Promise<RecommendationResult> {
  const url = `${SUPABASE_URL}/functions/v1/get-recommendations?productId=${encodeURIComponent(productId)}&page=${page}&limit=${limit}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`get-recommendations ${res.status}`);
  const json = await res.json();
  return { products: Array.isArray(json?.products) ? json.products : [], hasMore: !!json?.hasMore };
}

export function getRecommendations(
  productId: string,
  page = 0,
  limit = 12,
): Promise<RecommendationResult> {
  const key = `recs:${productId}:${page}:${limit}`;
  return cachedQuery(key, () => coalesce(key, () => callEdge(productId, page, limit)), {
    ttlMs: TTL_MS,
    persist: true,
  });
}
