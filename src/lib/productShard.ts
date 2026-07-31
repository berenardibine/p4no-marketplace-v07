// Deterministic hash-sharding for product static files (browser side).
// Must stay byte-identical to supabase/functions/_shared/shard.ts.
//
//   products/<shard>/<slug>.json   where shard = first byte of SHA-256(slug)
//
// Computed locally from the URL slug — zero lookups, zero DB reads.

const memo = new Map<string, string>();

export async function shardOf(key: string): Promise<string> {
  const k = String(key);
  const hit = memo.get(k);
  if (hit) return hit;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(k));
  const shard = new Uint8Array(buf)[0].toString(16).padStart(2, '0');
  memo.set(k, shard);
  return shard;
}

/** Static path (no .json suffix) for a product detail payload. */
export async function productStaticPath(key: string): Promise<string> {
  return `products/${await shardOf(key)}/${key}`;
}

/** True when the given static path is a sharded product detail file. */
export function isProductDetailPath(path: string): boolean {
  return /^products\/[0-9a-f]{2}\/[^/]+$/.test(path.replace(/^\/+/, '').replace(/\.json$/, ''));
}
