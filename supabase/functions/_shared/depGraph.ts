// Static Architecture V3 — server-side dependency graph.
// Given a change event on a business entity, resolve the FULL set of
// static paths (without the .json suffix) that must be regenerated.
//
// Called by static-worker to expand queue rows before it delegates to
// static-generate. Nothing outside the graph is regenerated.

export type Entity =
  | "product"
  | "service"
  | "article"
  | "reel"
  | "category"
  | "shop"
  | "seller";

export type Action = "insert" | "update" | "delete";

export interface ChangeEvent {
  entity: Entity;
  id?: string | null;
  slug?: string | null;
  category?: string | null;
  action: Action;
}

export interface ResolvedTarget {
  /** Static path (no .json suffix). */
  path: string;
  /** True → generator should DELETE the file instead of regenerating it. */
  remove?: boolean;
  /** Generator entity name (matches static-generate router). */
  entity: string;
  /** Optional detail slug for detail generators. */
  slug?: string;
  /** Optional category slug for category generators. */
  category?: string;
}

function detailKey(ev: ChangeEvent): string | null {
  return (ev.slug ?? ev.id) || null;
}

/**
 * Returns the exhaustive list of paths to regenerate for a single change.
 * Callers must dedupe across many events.
 */
export function resolveTargets(ev: ChangeEvent): ResolvedTarget[] {
  const out: ResolvedTarget[] = [];
  const key = detailKey(ev);
  const del = ev.action === "delete";

  switch (ev.entity) {
    case "product": {
      // Feeds always regen. Detail regens on insert/update; DELETE removes it.
      out.push(
        { path: "products/latest", entity: "product" },
        { path: "products/popular", entity: "product" },
        { path: "products/featured", entity: "product" },
        { path: "products/trending", entity: "product" },
        { path: "products/search-index", entity: "product" },
        { path: "feeds/latest", entity: "feeds" },
        { path: "feeds/popular", entity: "feeds" },
        { path: "feeds/featured", entity: "feeds" },
        { path: "feeds/trending", entity: "feeds" },
        { path: "search/search-index", entity: "search" },
        { path: "homepage", entity: "homepage" },
      );
      if (key) {
        out.push({
          path: `product/${key}`,
          entity: "product",
          slug: key,
          remove: del,
        });
      }
      if (ev.category) {
        out.push({
          path: `products/category/${ev.category}`,
          entity: "category",
          category: ev.category,
        });
        out.push({
          path: `categories/${ev.category}/index`,
          entity: "category-page",
          category: ev.category,
        });
      }
      break;
    }
    case "service": {
      out.push(
        { path: "services/latest", entity: "service" },
        { path: "services/featured", entity: "service" },
        { path: "services/trending", entity: "service" },
        { path: "search/search-index", entity: "search" },
        { path: "homepage", entity: "homepage" },
      );
      if (key) {
        out.push({
          path: `service/${key}`,
          entity: "service",
          slug: key,
          remove: del,
        });
      }
      break;
    }
    case "article": {
      out.push(
        { path: "articles/latest", entity: "article" },
        { path: "articles/trending", entity: "article" },
        { path: "search/search-index", entity: "search" },
        { path: "homepage", entity: "homepage" },
      );
      if (key) {
        out.push({
          path: `article/${key}`,
          entity: "article",
          slug: key,
          remove: del,
        });
      }
      break;
    }
    case "reel": {
      out.push(
        { path: "reels/latest", entity: "reel" },
        { path: "reels/trending", entity: "reel" },
        { path: "homepage", entity: "homepage" },
      );
      // Reels reuse the product feed lists as well.
      out.push(
        { path: "products/latest", entity: "product" },
        { path: "products/trending", entity: "product" },
      );
      if (key) {
        out.push({
          path: `product/${key}`,
          entity: "product",
          slug: key,
          remove: del,
        });
      }
      break;
    }
    case "category": {
      out.push(
        { path: "categories/all", entity: "category" },
        { path: "categories/menu", entity: "category" },
        { path: "categories/home", entity: "category" },
        { path: "homepage", entity: "homepage" },
      );
      if (ev.category) {
        out.push({
          path: `products/category/${ev.category}`,
          entity: "category",
          category: ev.category,
        });
        out.push({
          path: `categories/${ev.category}/index`,
          entity: "category-page",
          category: ev.category,
        });
      }
      break;
    }
    case "shop":
    case "seller": {
      out.push(
        { path: "products/latest", entity: "product" },
        { path: "products/popular", entity: "product" },
        { path: "homepage", entity: "homepage" },
      );
      if (key) {
        out.push({
          path: `${ev.entity}/${key}`,
          entity: ev.entity,
          slug: key,
          remove: del,
        });
      }
      break;
    }
  }

  // Dedupe by path (keeping first occurrence — removals win via a later pass).
  const seen = new Set<string>();
  const uniq: ResolvedTarget[] = [];
  for (const t of out) {
    if (seen.has(t.path)) continue;
    seen.add(t.path);
    uniq.push(t);
  }
  return uniq;
}

/**
 * Group many events into a single generator plan. Removes any path that is
 * both regenerated and removed (removal wins so we never stage-then-orphan).
 */
export function planFromEvents(events: ChangeEvent[]): {
  regenerate: ResolvedTarget[];
  remove: ResolvedTarget[];
} {
  const regenMap = new Map<string, ResolvedTarget>();
  const removeMap = new Map<string, ResolvedTarget>();
  for (const ev of events) {
    for (const t of resolveTargets(ev)) {
      if (t.remove) removeMap.set(t.path, t);
      else if (!regenMap.has(t.path)) regenMap.set(t.path, t);
    }
  }
  // Removal takes precedence.
  for (const p of removeMap.keys()) regenMap.delete(p);
  return {
    regenerate: Array.from(regenMap.values()),
    remove: Array.from(removeMap.values()),
  };
}