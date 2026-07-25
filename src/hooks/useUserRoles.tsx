import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'admin' | 'moderator' | 'user' | 'buyer' | 'seller';

export const useUserRoles = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = useCallback(async () => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    setRoles((data?.map((r: any) => r.role as AppRole)) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const hasRole = (r: AppRole) => roles.includes(r);
  const isSeller = hasRole('seller');
  const isBuyer = hasRole('buyer');
  const isAdmin = hasRole('admin');
  const hasAnyRole = roles.length > 0;

  const addRole = async (role: AppRole) => {
    if (!user) return;
    await supabase.from('user_roles').insert({ user_id: user.id, role });
    await fetchRoles();
  };

  return { roles, loading, hasRole, isSeller, isBuyer, isAdmin, hasAnyRole, addRole, refetch: fetchRoles };
};
