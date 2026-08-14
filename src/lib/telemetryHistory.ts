// P4NO Rolling Telemetry History
// ------------------------------------------------------------------
// WHY: the Unified Monitor used to start from an EMPTY state. A visitor
// browsed the public site, then opened /admin/cache — and every public event
// that already happened was gone, so PUBLIC always read 0 while the admin's
// own requests were visible. That is a measurement bug, not a traffic fact.
//
// This module keeps a rolling window of REAL observed delivery samples in
// localStorage (shared across tabs of the same browser, survives navigation
// and full reloads). The monitor seeds itself from this history on mount.
//
// Cost profile: zero network, zero database. Writes are throttled and the
// buffer is hard-capped, so it can never grow without bound.

import type { DeliverySample } from './telemetryBus';

const KEY = 'p4no_tele_hist:v1';
/** Forensic window kept for the monitor. */
export const HISTORY_WINDOW_MS = 15 * 60 * 1000;
const MAX_ROWS = 800;
const PERSIST_THROTTLE_MS = 2000;

let buffer: DeliverySample[] = [];
let hydrated = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function prune(rows: DeliverySample[], now = Date.now()): DeliverySample[] {
  const cutoff = now - HISTORY_WINDOW_MS;
  const kept = rows.filter((r) => (r.at ?? 0) >= cutoff);
  return kept.length > MAX_ROWS ? kept.slice(kept.length - MAX_ROWS) : kept;
}

function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) buffer = prune(JSON.parse(raw) as DeliverySample[]);
  } catch {
    buffer = [];
  }
}

function schedulePersist() {
  if (typeof window === 'undefined' || persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      buffer = prune(buffer);
      localStorage.setItem(KEY, JSON.stringify(buffer));
    } catch {
      // Quota or private mode — history stays in-memory only.
    }
  }, PERSIST_THROTTLE_MS);
}

/** Record one observed sample into the rolling history. */
export function pushHistory(sample: DeliverySample): void {
  hydrate();
  buffer.push(sample);
  if (buffer.length > MAX_ROWS) buffer.splice(0, buffer.length - MAX_ROWS);
  schedulePersist();
}

/** Every real sample observed inside the rolling window (oldest → newest). */
export function readHistory(): DeliverySample[] {
  hydrate();
  buffer = prune(buffer);
  return buffer.slice();
}

export function clearHistory(): void {
  hydrated = true;
  buffer = [];
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__P4NO_TELEMETRY_HISTORY__ = readHistory;
}
