import { useEffect, useRef } from 'react';
import { useLoadingState } from '@/context/LoadingContext';

/**
 * Activate the global splash overlay while `active` is true.
 * Auto-releases when `active` flips to false or the component unmounts.
 *
 * Safety: a hard cap of 8s releases the loader to avoid getting stuck
 * on slow networks / dead requests.
 */
export const useLoader = (label: string, active: boolean) => {
  const { show, hide } = useLoadingState();
  const tokenRef = useRef<string | null>(null);
  const capRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active && !tokenRef.current) {
      tokenRef.current = show(label);
      capRef.current = setTimeout(() => {
        if (tokenRef.current) { hide(tokenRef.current); tokenRef.current = null; }
      }, 8000);
    } else if (!active && tokenRef.current) {
      hide(tokenRef.current);
      tokenRef.current = null;
      if (capRef.current) clearTimeout(capRef.current);
    }

    return () => {
      if (tokenRef.current) { hide(tokenRef.current); tokenRef.current = null; }
      if (capRef.current) clearTimeout(capRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, label]);
};
