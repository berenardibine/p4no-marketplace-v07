// Timeout-bounded fetch for public data delivery.
//
// Why: on some mobile ISPs the static origin / API host is blackholed (SYN never
// answered). A plain `fetch` then stays pending forever and the UI is stuck on
// "loading" with no error and no retry. Every public read must be able to FAIL.

export const NET_TIMEOUT_MS = 8000;

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = NET_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}
