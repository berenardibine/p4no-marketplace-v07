import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/** Renders children (and therefore their data requests) only after an explicit tap.
 *  Auto-opens when the URL hash targets this section (e.g. notification deep links). */
const ClickToLoad = ({ label, anchor, children }: { label: string; anchor?: string; children: ReactNode }) => {
  const [open, setOpen] = useState(() =>
    !!anchor && typeof window !== 'undefined' && window.location.hash.replace('#', '').startsWith(anchor),
  );
  if (open) return <>{children}</>;
  return (
    <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
      {label}
    </Button>
  );
};

export default ClickToLoad;
