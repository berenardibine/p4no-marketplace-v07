// Redis has been removed from this project. These stubs remain so any lingering
// imports keep type-checking; REDIS_ONLY is always false and assertRedisOnly is
// a no-op.
export const REDIS_ONLY = false;

export class RedisOnlyError extends Error {
  constructor(where: string, detail?: unknown) {
    super(`[REDIS_ONLY] ${where}${detail ? ` — ${String(detail)}` : ''}`);
    this.name = 'RedisOnlyError';
  }
}

export function assertRedisOnly(_where: string, _detail?: unknown): void {
  /* no-op: Redis removed */
}
