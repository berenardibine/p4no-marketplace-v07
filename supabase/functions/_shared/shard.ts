// Deterministic hash-sharding for product static files.
//
// A product's JSON lives at:  products/<shard>/<slug>.json
// where <shard> = first 2 hex chars of SHA-256(slug || id).
//
// The shard is derived from the SAME key the URL exposes (slug, or the UUID
// when no slug exists), so the browser can compute the exact path locally —
// no lookup table, no extra request, no DB read. 256 folders keep any single
// directory small enough to scale to millions of products.

export async function shardOf(key: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(key)));
  const b = new Uint8Array(buf)[0];
  return b.toString(16).padStart(2, "0");
}

/** Static path (no .json suffix) for a product detail payload. */
export async function productStaticPath(key: string): Promise<string> {
  return `products/${await shardOf(key)}/${key}`;
}

/** All shard folder names, 00..ff. */
export const ALL_SHARDS: string[] = Array.from({ length: 256 }, (_, i) =>
  i.toString(16).padStart(2, "0")
);
