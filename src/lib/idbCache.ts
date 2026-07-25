// Minimal IndexedDB cache for static JSON payloads served from the CDN.
// Records are keyed by path (e.g. "products/latest") and carry the manifest
// version they were fetched at. On version bump, we can serve stale data
// immediately while the network fetch replaces it (SWR).

import { openDB, type IDBPDatabase } from 'idb';

interface Rec {
  key: string;
  version: number;
  data: unknown;
  updated_at: number;
}

const DB_NAME = 'p4no-static-v1';
const STORE = 'entries';

let dbp: Promise<IDBPDatabase> | null = null;
function db(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'key' });
      },
    });
  }
  return dbp;
}

export async function idbGet<T = unknown>(
  key: string,
): Promise<{ data: T; version: number; updated_at: number } | null> {
  try {
    const rec = (await (await db()).get(STORE, key)) as Rec | undefined;
    if (!rec) return null;
    return { data: rec.data as T, version: rec.version, updated_at: rec.updated_at };
  } catch {
    return null;
  }
}

export async function idbPut(key: string, data: unknown, version: number): Promise<void> {
  try {
    await (await db()).put(STORE, { key, data, version, updated_at: Date.now() } as Rec);
  } catch {
    /* ignore */
  }
}

export async function idbDelete(key: string): Promise<void> {
  try {
    await (await db()).delete(STORE, key);
  } catch {
    /* ignore */
  }
}

export async function idbClear(): Promise<void> {
  try {
    await (await db()).clear(STORE);
  } catch {
    /* ignore */
  }
}

/**
 * Remove any cached entries whose keys are not present in the provided set.
 * Called after a manifest refresh so deleted/renamed content evicts locally.
 */
export async function idbBulkPrune(validKeys: Set<string>): Promise<number> {
  try {
    const d = await db();
    const tx = d.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    let removed = 0;
    let cursor = await store.openCursor();
    while (cursor) {
      const key = cursor.key as string;
      if (!validKeys.has(key)) {
        cursor.delete();
        removed += 1;
      }
      cursor = await cursor.continue();
    }
    await tx.done;
    return removed;
  } catch {
    return 0;
  }
}

/** Iterate every cached key (useful for diagnostics). */
export async function idbKeys(): Promise<string[]> {
  try {
    return (await (await db()).getAllKeys(STORE)) as string[];
  } catch {
    return [];
  }
}