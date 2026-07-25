// Static Architecture V3 — Traffic Guard.
// -----------------------------------------------------------
// Wraps guarded public reads with a shared assertion so any
// regression that queries PostgREST for public content is caught
// immediately in dev/strict mode and logged (never crashes) in prod.
//
// Usage:
//   assertNotStrict('products');              // throws in strict mode
//   if (isPublicReadBlocked('products')) return null;
//
// This is intentionally NOT a global fetch interceptor — it must
// stay opt-in per hook so authenticated / write flows on the same
// tables keep working.

import { isStrictStaticMode } from './staticFlags';
import { markViolation } from './cdnGuard';

const PUBLIC_TABLES = new Set<string>([
  'products',
  'services',
  'insight_articles',
  'reels',
  'categories',
  'service_categories',
  'insight_categories',
  'shops',
]);

export function isPublicTable(name: string): boolean {
  return PUBLIC_TABLES.has(name);
}

export function isPublicReadBlocked(table: string): boolean {
  return isPublicTable(table) && isStrictStaticMode();
}

/** Throw in strict mode, warn in prod. Call from any public read path. */
export function assertNotStrict(table: string, note?: string): void {
  if (!isPublicTable(table)) return;
  const msg = `[publicReadGuard] Blocked PostgREST read of "${table}"${
    note ? ` (${note})` : ''
  } — public content must be served from static/CDN. See src/lib/publicReadGuard.ts`;
  markViolation(table, note);
  if (isStrictStaticMode()) throw new Error(msg);
  if (typeof console !== 'undefined') console.warn(msg);
}