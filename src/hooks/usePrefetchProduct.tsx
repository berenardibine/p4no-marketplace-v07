import { useEffect, useRef } from 'react';
import { prefetchProduct } from '@/lib/prefetch';

/**
 * Warms a product's static JSON once its card scrolls into view, and again
 * with priority on pointer intent. Zero database cost — CDN/static only.
 */
export function usePrefetchProduct<T extends HTMLElement = HTMLDivElement>(key?: string) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !key || typeof IntersectionObserver === 'undefined') return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            void prefetchProduct(key);
            io.disconnect();
          }
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);

    const intent = () => void prefetchProduct(key, true);
    el.addEventListener('pointerenter', intent, { once: true });
    el.addEventListener('touchstart', intent, { once: true, passive: true });

    return () => {
      io.disconnect();
      el.removeEventListener('pointerenter', intent);
      el.removeEventListener('touchstart', intent);
    };
  }, [key]);

  return ref;
}
