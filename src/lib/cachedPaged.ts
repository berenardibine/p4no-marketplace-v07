// Redis-backed paged fetcher has been removed. Stub kept to avoid import errors.
import { useState } from 'react';

export interface CachedPagedOptions {
  type: 'services' | 'reels' | 'articles';
  kind: string;
  slug?: string;
  viewPageSize?: number;
  enabled?: boolean;
}

export function useCachedPaged<T = any>(_opts: CachedPagedOptions) {
  const [items] = useState<T[]>([]);
  return { items, loading: false, hasMore: false, loadMore: async () => {} };
}
