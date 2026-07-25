import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

type Token = string;

interface LoadingState {
  active: Map<Token, string>;
  show: (label?: string) => Token;
  hide: (token: Token) => void;
  currentLabel: string;
  isActive: boolean;
}

const LoadingContext = createContext<LoadingState | null>(null);

export const LoadingProvider = ({ children }: { children: ReactNode }) => {
  const [active, setActive] = useState<Map<Token, string>>(new Map());
  const counter = useRef(0);

  const show = useCallback((label = 'Loading…') => {
    counter.current += 1;
    const token = `ld_${counter.current}_${Date.now()}`;
    setActive(prev => {
      const next = new Map(prev);
      next.set(token, label);
      return next;
    });
    return token;
  }, []);

  const hide = useCallback((token: Token) => {
    setActive(prev => {
      if (!prev.has(token)) return prev;
      const next = new Map(prev);
      next.delete(token);
      return next;
    });
  }, []);

  // Latest label wins
  const labels = Array.from(active.values());
  const currentLabel = labels[labels.length - 1] || 'Loading…';

  return (
    <LoadingContext.Provider value={{ active, show, hide, currentLabel, isActive: active.size > 0 }}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoadingState = () => {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    // Graceful fallback so components don't crash if provider is missing.
    return { active: new Map(), show: () => '', hide: () => {}, currentLabel: 'Loading…', isActive: false } as LoadingState;
  }
  return ctx;
};
