import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useAdminSettings = () => {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('admin_settings')
      .select('key, value');
    const map: Record<string, any> = {};
    (data || []).forEach((s: any) => {
      // Handle double-stringified values: if value is a string like "false"/"true", parse it
      let val = s.value;
      if (typeof val === 'string') {
        try { val = JSON.parse(val); } catch {}
      }
      map[s.key] = val;
    });
    setSettings(map);
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const updateSetting = async (key: string, value: any) => {
    // Don't JSON.stringify - the jsonb column handles serialization via Supabase client
    await (supabase as any)
      .from('admin_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const getSetting = (key: string, defaultValue: any = null) => {
    if (loading) return defaultValue;
    return settings[key] ?? defaultValue;
  };

  return { settings, loading, updateSetting, getSetting, refresh: fetchSettings };
};
