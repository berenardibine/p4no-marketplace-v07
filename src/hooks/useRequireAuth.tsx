import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';

/**
 * Gate restricted actions behind a friendly "create a free account" prompt.
 * Usage:
 *   const { requireAuth, promptOpen, setPromptOpen } = useRequireAuth();
 *   <button onClick={() => requireAuth(() => doThing())}>Save</button>
 *   <GuestPromptDialog open={promptOpen} onOpenChange={setPromptOpen} />
 */
export const useRequireAuth = () => {
  const { user } = useAuth();
  const [promptOpen, setPromptOpen] = useState(false);

  const requireAuth = useCallback((action: () => void) => {
    if (user) { action(); return true; }
    setPromptOpen(true);
    return false;
  }, [user]);

  return { requireAuth, promptOpen, setPromptOpen, isAuthenticated: !!user };
};
