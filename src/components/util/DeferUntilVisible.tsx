import { useEffect, useRef, useState, ReactNode } from 'react';

/**
 * Renders children only after the placeholder scrolls within `rootMargin`.
 * Avoids fetching Q&A, comments, related, recommendations until the user
 * actually scrolls there — major egress + DB win on detail pages.
 */
interface Props {
  children: ReactNode;
  rootMargin?: string;
  minHeight?: number;
  fallback?: ReactNode;
}

const DeferUntilVisible = ({
  children,
  rootMargin = '200px',
  minHeight = 80,
  fallback = null,
}: Props) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible || !ref.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [rootMargin, visible]);

  return (
    <div ref={ref} style={visible ? undefined : { minHeight }}>
      {visible ? children : fallback}
    </div>
  );
};

export default DeferUntilVisible;