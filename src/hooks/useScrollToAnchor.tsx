import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Reads ?comment=, ?reply=, ?question=, ?answer= from the URL and scrolls
 * to the matching element (by `id` or `data-anchor-id`), briefly highlighting it.
 * Re-runs whenever `ready` becomes true so callers can wait for content to render.
 */
export function useScrollToAnchor(ready: boolean = true) {
  const location = useLocation();

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams(location.search);
    const keys = ['reply', 'comment', 'answer', 'question'] as const;
    let targetId: string | null = null;
    for (const k of keys) {
      const v = params.get(k);
      if (v) {
        targetId = `${k}-${v}`;
        break;
      }
    }
    if (!targetId) return;

    let attempts = 0;
    const tryScroll = () => {
      const el =
        document.getElementById(targetId!) ||
        document.querySelector<HTMLElement>(`[data-anchor-id="${targetId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'transition-shadow');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
        }, 2500);
        return;
      }
      if (++attempts < 20) setTimeout(tryScroll, 250);
    };
    // Wait a tick for content to mount
    setTimeout(tryScroll, 200);
  }, [ready, location.search]);
}
